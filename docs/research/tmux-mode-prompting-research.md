# Research: tmux Teammate-Mode Prompting Persistence Issue

**Date**: 2026-02-13
**Issue**: When launching Claude Code with `--teammate-mode tmux`, users are still prompted to select tmux mode every time a teammate is spawned.

---

## Executive Summary

The `--teammate-mode` CLI flag IS captured and cached within a session via a "snapshot" mechanism, and the BackendRegistry caches its backend selection. However, there are multiple scenarios where the prompting can recur. The **recommended fix** is to set `"teammateMode": "tmux"` in `~/.claude/settings.json` instead of relying solely on the CLI flag.

---

## 1. Binary Analysis: How Teammate Mode Works Internally

### Location
- Binary: `/opt/homebrew/Caskroom/claude-code/2.1.39/claude` (resolved from `/opt/homebrew/bin/claude`)
- Version: 2.1.39

### The `--teammate-mode` Flag
- **Hidden flag** — NOT shown in `claude --help` output
- Defined internally at line 172901: `--teammate-mode <mode>` with description "How to spawn teammates: 'tmux', 'in-process', or 'auto'"
- Default: `auto`
- Valid values: `tmux`, `in-process`, `auto`

### Snapshot Mechanism (mode persistence within a session)
The mode is persisted within a session via a "TeammateModeSnapshot" system:

| Function | Purpose |
|:---------|:--------|
| `captureTeammateModeSnapshot` | Captures mode at session start from CLI override or config |
| `getTeammateModeFromSnapshot` | Retrieves the captured mode during the session |
| `setCliTeammateModeOverride` | Sets CLI override (from `--teammate-mode` flag) |
| `clearCliTeammateModeOverride` | Clears CLI override |
| `getCliTeammateModeOverride` | Reads current CLI override |
| `resetTeammateModeSnapshot_FOR_TESTS_ONLY` | Test-only reset |

Debug log messages from the snapshot system:
```
[TeammateModeSnapshot] Captured from CLI override: <mode>
[TeammateModeSnapshot] Captured from config: <mode>    (reads settings.json `teammateMode`)
[TeammateModeSnapshot] CLI override cleared, new mode: <mode>
getTeammateModeFromSnapshot called before capture - this indicates an initialization bug
```

### BackendRegistry (backend selection and caching)
The BackendRegistry determines which backend to use for spawning teammates:

```
[BackendRegistry] Using cached backend: <type>           ← Cache hit, no re-detection
[BackendRegistry] Starting backend detection...
[BackendRegistry] Environment: insideTmux=<bool>, inITerm2=<bool>
```

**Selection logic** (from binary strings):
1. If `insideTmux=true`: → `tmux (running inside tmux session)`
2. If user prefers tmux over iTerm2: → Skip iTerm2 detection entirely (`"User prefers tmux over iTerm2, skipping iTerm2 detection"`)
3. If `inITerm2=true` AND `it2` CLI available: → `iterm2 (native iTerm2 with it2 CLI)`
4. If `inITerm2=true` AND `it2` NOT available BUT tmux available: → `tmux (fallback in iTerm2, it2 setup recommended)`
5. If NOT in tmux or iTerm2 BUT tmux available: → `tmux (external session mode)`
6. Otherwise: → ERROR: No pane backend available

**In-process fallback logic**:
```
[BackendRegistry] isInProcessEnabled: true (non-interactive session)    ← Teammates are non-interactive
[BackendRegistry] isInProcessEnabled: <bool> (mode=<mode>, insideTmux=<bool>)
```

### `resetBackendDetection` — The Likely Culprit
A function `resetBackendDetection` exists (line 134065) and is called in the teammate spawn flow (referenced at line 148254: `Cannot destructure property 'resetBackendDetection' from null or undefined value`).

**This function resets the cached backend**, forcing re-detection on the next teammate spawn. If the re-detection hits the iTerm2 path (scenario #4 above), it will trigger the "iTerm2 Split Pane Setup" dialog.

---

## 2. The "iTerm2 Split Pane Setup" Dialog

This is most likely the actual "prompt" users are seeing. It appears when:
- iTerm2 is detected (`ITERM_SESSION_ID` env var present)
- `it2` CLI is not installed or verification fails
- Mode is `auto` or detection falls through to iTerm2 path

### Dialog Options (from binary strings, lines 148136-148203):

**Initial dialog** ("iTerm2 Split Pane Setup"):
- "Install it2 now" (install) — Uses uvx/pipx/pip to install the `it2` CLI tool
- "Use tmux instead" (tmux) — Opens teammates in a separate tmux session
- "Cancel" (cancel) — Skip teammate spawning for now

**If installation fails** ("Installation failed"):
- "Try again" (retry) — Retry the installation
- "Use tmux instead" (tmux) — Falls back to tmux for teammate panes
- "Cancel" (cancel) — Skip teammate spawning for now

**If verification fails**:
- "Try again" (retry) — Verify the connection again
- "Use tmux instead" (tmux) — Falls back to tmux for teammate panes
- "Cancel" (cancel) — Skip teammate spawning for now

---

## 3. How Teammates Are Spawned (Pane Backend)

When a teammate is spawned via the tmux pane backend, the command includes these flags (lines 148256-148265):

```bash
claude \
  --agent-id <id> \
  --agent-name <name> \
  --team-name <team> \
  --agent-color <color> \
  --parent-session-id <id> \
  --plan-mode-required \
  --agent-type <type> \
  --model <model> \
  --permission-mode acceptEdits
```

With environment: `CLAUDECODE=1 CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

**NOTABLY MISSING: `--teammate-mode` is NOT passed to spawned teammates.**

However, this is by design — spawned teammates are non-interactive sessions that use in-process mode internally. They don't need to detect backends because they don't spawn sub-teammates.

---

## 4. Current Environment State

```
ITERM_SESSION_ID=w2t2p0:103429BF-9CDC-4A1C-B520-281A525AC0B2
ITERM_PROFILE=Default
TMUX=/private/tmp/tmux-501/claude-swarm-16612,27528,0
TMUX_PANE=%1
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

- `it2` CLI: installed at `/Users/nathan.heaps/.local/bin/it2`
- No `teammateMode` configured in `~/.claude/settings.json` or `.claude/settings.json`

---

## 5. The `claude-team` Helper Script

The `claude-team` / `ct` script (`bin/claude-team`) handles:
1. Interactive mode picker via `gum choose` (runs **once** at launch, not per teammate)
2. Passes `--teammate-mode <mode>` to the claude binary
3. Auto-launches `tmux -CC` if tmux mode selected but not already in tmux
4. Exports `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`

The script's `gum choose` prompt is NOT the recurring prompt — it only runs at script launch.

---

## 6. Settings.json Configuration

### What the user currently has:
- `~/.claude/settings.json`: No `teammateMode` key
- `.claude/settings.json` (project): No `teammateMode` key

### What should be added:
```json
{
  "teammateMode": "tmux"
}
```

This tells the BackendRegistry to:
1. Read the mode from config via the snapshot mechanism
2. **Skip iTerm2 detection entirely** (log: "User prefers tmux over iTerm2, skipping iTerm2 detection")
3. Use tmux directly without prompting

---

## 7. Known GitHub Issues (from web research)

| Issue | Title | Relevance |
|:------|:------|:----------|
| [#24108](https://github.com/anthropics/claude-code/issues/24108) | Teammates stuck at idle prompt in tmux split-pane mode | Mailbox polling doesn't activate at initial idle state |
| [#24771](https://github.com/anthropics/claude-code/issues/24771) | Split panes open but teammates disconnected from messaging | IPC/messaging channel failure between lead and pane teammates |
| [#24301](https://github.com/anthropics/claude-code/issues/24301) | Auto-detection silently falls back to in-process | `auto` mode doesn't warn when falling back from split-pane |
| [#23527](https://github.com/anthropics/claude-code/issues/23527) | Pane-base-index mismatch | Claude Code assumes 0-based pane indexing |
| [#24292](https://github.com/anthropics/claude-code/issues/24292) | iTerm2 split panes not created | Split panes fail despite prerequisites met |

---

## 8. Root Cause Analysis

The recurring prompt is most likely caused by one or more of:

### Scenario A: `resetBackendDetection` clears cache between spawns
The `resetBackendDetection` function is called in the teammate spawn flow. If it clears the cached backend, each subsequent teammate spawn triggers a fresh backend detection, which may hit the iTerm2 setup dialog path.

### Scenario B: iTerm2 detected + `it2` verification fails
Even with `it2` installed, if verification fails (e.g., Python API not enabled in iTerm2, or `it2` binary in unexpected location), the detection path falls to the "fallback in iTerm2, it2 setup recommended" path, which triggers the setup dialog.

### Scenario C: No `teammateMode` in settings.json
Without `teammateMode: "tmux"` in settings.json, the snapshot captures the CLI override but the BackendRegistry doesn't get the "user prefers tmux" signal needed to skip iTerm2 detection.

### Most Likely: Combination of A + C
The CLI flag sets the snapshot, but `resetBackendDetection` clears the backend cache before each spawn. Without `teammateMode: "tmux"` in settings.json, the re-detection doesn't know to skip iTerm2, and hits the setup dialog.

---

## 9. Recommended Fixes

### Fix 1: Add `teammateMode` to settings.json (Primary Fix)
Add to `~/.claude/settings.json`:
```json
{
  "teammateMode": "tmux"
}
```

This ensures:
- The snapshot captures from config (persistent, not per-session)
- BackendRegistry sees "user prefers tmux" and skips iTerm2 detection
- No iTerm2 setup dialog triggered

### Fix 2: Ensure iTerm2 Python API is enabled (Secondary)
If using iTerm2 native mode instead of tmux:
- iTerm2 → Settings → General → Magic → Enable Python API
- Verify `it2` works: `it2 check`

### Fix 3: Update `claude-team` script to also set config (Enhancement)
The `claude-team` script could write `teammateMode` to a settings file or set an env var that the BackendRegistry respects, ensuring the CLI flag has full effect.

---

## 10. Summary

| Aspect | Finding |
|:-------|:--------|
| **CLI flag** | `--teammate-mode tmux` exists (hidden), captured by snapshot |
| **Snapshot** | Mode IS persisted within session via snapshot mechanism |
| **Backend cache** | BackendRegistry caches selection, BUT `resetBackendDetection` may clear it |
| **Settings.json** | `teammateMode: "tmux"` is the most reliable persistence mechanism |
| **iTerm2 dialog** | Shows when it2 setup incomplete or detection falls through |
| **Spawned teammates** | Don't receive `--teammate-mode`, use in-process (by design) |
| **Fix** | Set `teammateMode: "tmux"` in `~/.claude/settings.json` |
