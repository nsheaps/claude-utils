# Implementation Plan: 3-Script Architecture

**Status**: Draft
**Created**: 2026-02-13
**Source**: Plan agent analysis of current codebase

## Executive Summary

The current `bin/claude-team` is a monolith that handles infrastructure (tmux detection, gum interactive picker), orchestration config (env vars, CLI flags, hooks JSON, system prompt), AND directly invokes `claude` — bypassing `run-claude` entirely. This means agent team sessions miss brew update checks, settings backup, and the `simple_claudeish` permission wrapper.

The fix is a 3-layer architecture:

```
claude-team (infra) --> claude-team-orchestrator (orchestrator config) --> run-claude (central launch)
```

## Current Flow (Problem)

```
claude-team
  |- parse args (-m/--mode, --no-interactive)
  |- gum interactive mode picker
  |- tmux detection & LAUNCH_TMUX_CC flag
  |- build ORCHESTRATOR_PROMPT
  |- build HOOKS_SETTINGS_JSON
  |- build TEAM_FLAGS array
  |- export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
  |- claude_check_settings_backup + trap
  |- if tmux: exec tmux -CC new-session -- claude --dangerously-skip-permissions ...
  |- else:    command claude --dangerously-skip-permissions ...
```

Key problems:
1. Calls `claude` directly, not `run-claude` — misses brew updates, `simple_claudeish` wrapper
2. Passes `--dangerously-skip-permissions` itself — duplicates what `run-claude`/`simple_claudeish` already handles via `--allow-dangerously-skip-permissions`
3. Calls `claude_check_settings_backup` itself — `run-claude` already does this
4. Infrastructure and orchestration logic are tightly coupled

## Proposed Flow

```
claude-team (infra + user-facing entry point)
  |- parse infra args (-m/--mode, --no-interactive, -h/--help)
  |- gum interactive mode picker (if no mode specified)
  |- claude_check_for_updates    <-- brew update check happens HERE (once, at top)
  |- tmux detection
  |- if tmux needed:
  |    exec tmux -CC new-session -- claude-team-orchestrator --mode $MODE [-- $CLAUDE_ARGS...]
  |- else:
  |    exec claude-team-orchestrator --mode $MODE [-- $CLAUDE_ARGS...]

claude-team-orchestrator (orchestrator config)
  |- parse orchestrator args (--mode is REQUIRED here)
  |- export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
  |- build ORCHESTRATOR_PROMPT
  |- build HOOKS_SETTINGS_JSON
  |- build TEAM_FLAGS array (--teammate-mode, --permission-mode, --continue, --append-system-prompt, --settings)
  |- exec run-claude --skip-update-check "${TEAM_FLAGS[@]}" "${CLAUDE_ARGS[@]}"

run-claude (central launch)
  |- parse --skip-update-check flag (strip from passthrough args)
  |- if NOT skipped: claude_check_for_updates
  |- claude_check_settings_backup + EXIT trap
  |- simple_claudeish "$@" (adds --allow-dangerously-skip-permissions, calls claude)
```

**Update check flow:**
- `claude-team` path: check once at top → orchestrator passes `--skip-update-check` → `run-claude` skips
- Direct `run-claude` path: no skip flag → `run-claude` checks as before
- Future `claude-team-worker` path: also passes `--skip-update-check` (check already done by `claude-team`)

## Detailed Design

### 1. `bin/claude-team` (Infrastructure Layer)

**Keeps:**
- Shebang, `set -euo pipefail`, source `claude.lib.sh`
- `show_help()` function (updated to reflect new architecture)
- Arg parsing for: `-m/--mode`, `--no-interactive`, `-h/--help`, `--`, passthrough args
- Mode validation (`auto|in-process|tmux`)
- Interactive gum mode picker (when no mode specified and interactive)
- `CLAUDE_TEAM_DEFAULT_MODE` env var fallback
- tmux detection logic (`command -v tmux`, `$TMUX` check, `LAUNCH_TMUX_CC` flag)
- `check_and_install tmux` when tmux mode selected
- `check_and_install gum` for interactive picker
- Success/hint output messages before launch

**Gains (hoisted from `run-claude`):**
- `claude_check_for_updates` — called once before tmux/orchestrator launch (user-facing, interactive)

**Removes (moves to orchestrator):**
- `ORCHESTRATOR_PROMPT` construction
- `HOOKS_SETTINGS_JSON` construction
- `TEAM_FLAGS` array construction
- `export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- `claude_check_settings_backup` + trap (handled by `run-claude`)
- Direct `claude` invocation

**New behavior:**
- After determining mode, delegates to `claude-team-orchestrator`
- For tmux path: `exec tmux -CC new-session -- "$SCRIPT_DIR/claude-team-orchestrator" --mode "$TEAMMATE_MODE" -- "${CLAUDE_ARGS[@]}"`
- For non-tmux path: `exec "$SCRIPT_DIR/claude-team-orchestrator" --mode "$TEAMMATE_MODE" -- "${CLAUDE_ARGS[@]}"`
- Uses `exec` in both paths so the process is replaced

### 2. `bin/claude-team-orchestrator` (Orchestrator Config Layer) — NEW FILE

**Responsibilities:**
- Parse its own args: `--mode MODE` (REQUIRED), `--` separator, passthrough `CLAUDE_ARGS`
- Export `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- Build `ORCHESTRATOR_PROMPT` string
- Build `HOOKS_SETTINGS_JSON` inline JSON
- Build `TEAM_FLAGS` array
- Call `run-claude` with team flags + passthrough args via `exec`

**Does NOT handle:**
- `--dangerously-skip-permissions` or `--allow-dangerously-skip-permissions` (that's `run-claude`'s job via `simple_claudeish`)
- Settings backup (that's `run-claude`'s job)
- Brew update checks (that's `claude-team`'s job; orchestrator passes `--skip-update-check` to `run-claude`)
- tmux launch (that's `claude-team`'s job)
- Interactive mode selection (that's `claude-team`'s job)

### 3. `bin/lib/claude.lib.sh` (Shared Library — NEW FUNCTION)

**Add `claude_check_for_updates()`:**
- Extract the brew update check logic (currently inline in `run-claude` lines 36-47) into a reusable function
- Checks `brew outdated --verbose` for configured formulae
- Prompts user with `gum confirm` to upgrade if updates available
- Formulae list: `("claude-code" "claude-utils")` — could be parameterized or kept as a constant

### 4. `bin/run-claude` (Central Launch — Minor Changes)

**Changes:**
- Add `--skip-update-check` flag parsing: strip the flag from `$@` before passing to `simple_claudeish`
- Replace inline brew update check with `claude_check_for_updates` (from lib)
- Skip the call if `--skip-update-check` was passed

**Behavior:**
- Direct invocation (`run-claude`): checks for updates as before
- Called by orchestrator (`run-claude --skip-update-check ...`): skips update check, passes remaining args through
- `--skip-update-check` is consumed by `run-claude` and NOT passed to `simple_claudeish`/`claude`

`simple_claudeish` prepends `--allow-dangerously-skip-permissions` before all passthrough args. Claude Code CLI uses named flags, not positional, so order doesn't matter.

The `--permission-mode delegate` from the orchestrator and `--allow-dangerously-skip-permissions` from `simple_claudeish` are complementary — permission mode applies to team coordination, skip-permissions applies to tool execution.

### 5. `bin/ct` (Shorthand — No Changes)

Already delegates via `exec "$SCRIPT_DIR/claude-team" "$@"`. Same external interface, zero changes needed.

## Arg Flow Through the Chain

### Team path (`claude-team` entry point)

```
User invocation:
  ct --mode tmux -- --resume

ct:
  exec claude-team --mode tmux -- --resume

claude-team:
  parse args → TEAMMATE_MODE=tmux, CLAUDE_ARGS=(--resume)
  claude_check_for_updates           <-- update check here (once, interactive)
  detect tmux → LAUNCH_TMUX_CC=true
  exec tmux -CC new-session -- claude-team-orchestrator --mode tmux -- --resume

claude-team-orchestrator:
  parse args → TEAMMATE_MODE=tmux, CLAUDE_ARGS=(--resume)
  exec run-claude --skip-update-check --teammate-mode tmux \
    --permission-mode delegate --continue \
    --append-system-prompt "..." --settings '{...}' --resume

run-claude:
  strip --skip-update-check (skip brew check)
  claude_check_settings_backup + EXIT trap
  simple_claudeish --teammate-mode tmux --permission-mode delegate --continue \
    --append-system-prompt "..." --settings '{...}' --resume

simple_claudeish:
  command claude --allow-dangerously-skip-permissions --teammate-mode tmux \
    --permission-mode delegate --continue --append-system-prompt "..." \
    --settings '{...}' --resume
```

### Direct path (`run-claude` entry point)

```
User invocation:
  run-claude --continue

run-claude:
  no --skip-update-check → claude_check_for_updates   <-- update check here
  claude_check_settings_backup + EXIT trap
  simple_claudeish --continue

simple_claudeish:
  command claude --allow-dangerously-skip-permissions --continue
```

## Flag Ownership

| Flag | Owned By | Notes |
|------|----------|-------|
| `--allow-dangerously-skip-permissions` | `run-claude` (via `simple_claudeish`) | NEVER passed by orchestrator |
| `--skip-update-check` | `claude-team-orchestrator` | Consumed by `run-claude`, NOT passed to `claude` |
| `--teammate-mode` | `claude-team-orchestrator` | Passthrough to `run-claude` → `claude` |
| `--permission-mode delegate` | `claude-team-orchestrator` | Passthrough to `run-claude` → `claude` |
| `--continue` | `claude-team-orchestrator` | Passthrough to `run-claude` → `claude` |
| `--append-system-prompt` | `claude-team-orchestrator` | Passthrough to `run-claude` → `claude` |
| `--settings` | `claude-team-orchestrator` | Passthrough to `run-claude` → `claude` |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | `claude-team-orchestrator` (exported) | Inherited by `run-claude` and `claude` |

**Consumed flags** (stripped before passthrough): `--skip-update-check` is consumed by `run-claude` and never reaches `simple_claudeish` or `claude`.

## Settings Backup Deduplication

- `claude-team`: NO settings backup (it `exec`s away, so its trap would never fire anyway)
- `claude-team-orchestrator`: NO settings backup (it `exec`s away)
- `run-claude`: YES, retains `claude_check_settings_backup` + EXIT trap (this is the surviving process)

## Implementation Sequence

1. Add `claude_check_for_updates()` to `bin/lib/claude.lib.sh` — extract inline brew check from `run-claude`
2. Update `bin/run-claude` — replace inline brew check with lib call, add `--skip-update-check` flag parsing
3. Create `bin/claude-team-orchestrator` — new file, orchestration config, passes `--skip-update-check` to `run-claude`
4. Update `bin/claude-team` — remove orchestration logic, add `claude_check_for_updates` call, delegate to orchestrator
5. Update `test/cli-test.sh` — add tests for `claude-team-orchestrator`
6. NO changes to `bin/ct`

## Testing Strategy

1. `claude-team-orchestrator --help` — should show help text
2. `claude-team-orchestrator` (no --mode) — should fail with clear error
3. `claude-team-orchestrator --mode invalid` — should fail with clear error
4. `claude-team --help` — regression (should still work)
5. `ct --help` — regression (should still work)
6. `claude-team --mode invalid` — regression (should still reject)
7. All existing 17 tests pass

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| tmux -CC path uses absolute script path that might differ after Homebrew install | Use `$SCRIPT_DIR` which resolves via `readlink -f` — same pattern as existing `ct` |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` not inherited through tmux | `export` in `claude-team-orchestrator` which runs INSIDE the tmux session |
| `--settings` JSON with special characters breaks arg passing | Already works today — JSON passed as single arg in quotes |
| `--continue` might conflict with user-passed `--resume` | Claude Code handles this — user responsibility |
| `--skip-update-check` accidentally passed to `claude` | `run-claude` strips it before calling `simple_claudeish` |
| Update check runs inside tmux -CC (no TTY for gum) | Check runs in `claude-team` BEFORE `exec tmux`, so TTY is available |

## Files Changed

| File | Action | Summary |
|------|--------|---------|
| `bin/lib/claude.lib.sh` | Modify | Add `claude_check_for_updates()` function |
| `bin/run-claude` | Modify | Replace inline brew check with lib call, add `--skip-update-check` |
| `bin/claude-team-orchestrator` | Create | Orchestrator config layer, passes `--skip-update-check` |
| `bin/claude-team` | Modify | Strip orchestration logic, add update check, delegate to orchestrator |
| `test/cli-test.sh` | Modify | Add orchestrator tests |
| `bin/ct` | No change | |
| `bin/run-claude` (help text) | Modify | Document `--skip-update-check` flag |

## References

- [Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
- `docs/specs/draft/agent-orchestration.md` — longer-term vision
- `docs/specs/draft/agent-team-project.md` — provider-agnostic project PRD
- `.claude/skills/agent-teams/SKILL.md` — comprehensive skill reference
