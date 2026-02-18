# Launcher Spec vs claude-team Script — Gap Analysis

**Reviewer:** Wile E. Coyote (AI Agent Engineer)
**Date:** 2026-02-17
**Task:** #117
**Files compared:**
- Spec: `~/src/nsheaps/agent-team/docs/specs/draft/agent-launcher.md` (commit `04969ca`)
- Script: `~/src/nsheaps/claude-utils/bin/claude-team`

---

## Feature-by-Feature Comparison

| # | claude-team Feature | Spec Coverage | Status | Notes |
|---|---------------------|---------------|--------|-------|
| 1 | Interactive mode picker (gum) | §10: "flag on start, or interactive fallback" | COVERED | |
| 2 | iTerm2 tmux -CC auto-launch | §10: "Preserved in start command" | PARTIAL | Details missing (see Gap #1) |
| 3 | Hardcoded orchestrator prompt | §8: Read from orchestrator.md file | IMPROVED | Declarative > hardcoded |
| 4 | `--permission-mode delegate` | §3: `permission_mode` per-agent field | COVERED | |
| 5 | `--continue` | §3: `continue_session` per-agent field | COVERED | |
| 6 | `--dangerously-skip-permissions` | §3: `dangerously_skip_permissions` per-agent field | CHANGED | See Gap #2 |
| 7 | `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | §5: "The launcher always sets" | COVERED | |
| 8 | Hooks (SessionStart, Stop) | §8: Hooks configuration | COVERED | |
| 9 | `--settings` JSON flag | §8: Mentioned for hooks | COVERED | |
| 10 | `gum` dependency | §10: "Optional — only for interactive mode" | COVERED | |
| 11 | `claude_check_settings_backup` | §10: "Not carried over (rejected by user)" | EXCLUDED | Correct decision |
| 12 | `--no-interactive` flag | Not in spec | MISSING | See Gap #3 |
| 13 | `CLAUDE_TEAM_DEFAULT_MODE` env var | Not in spec | MISSING | See Gap #4 |
| 14 | Passthrough args (`-- CLAUDE_ARGS`) | Not in spec | MISSING | See Gap #5 |
| 15 | tmux installation check | Not in spec | MISSING | See Gap #6 |
| 16 | `ct` shorthand alias | Not in spec | MISSING | See Gap #7 |
| 17 | Help text with keyboard controls | Not in spec | MISSING | See Gap #8 |
| 18 | Colored output helpers (info/success/hint/fatal) | Not in spec | MISSING | UX concern |
| 19 | `set -euo pipefail` strict mode | N/A (TypeScript) | N/A | |
| 20 | Brew update check | §10: "Retained in entry point script" | COVERED | Correctly scoped |

---

## Gaps (Missing from Spec)

### Gap #1 (HIGH): tmux -CC Auto-Launch Details Missing

claude-team (lines 128-138, 188-196) has specific logic:
1. Check if `$TMUX` env var is set (are we already in tmux?)
2. If not and mode is tmux, auto-launch `tmux -CC new-session`
3. Uses `exec` to replace the shell process
4. Passes all flags to `claude` inside the new tmux session

The spec (§10) says "iTerm2 tmux -CC auto-launch: Preserved in start command" but doesn't document HOW. The `start` command (§9) doesn't mention tmux -CC detection or auto-launch.

**Risk:** Implementer won't know to detect `$TMUX` or use `tmux -CC` control mode. iTerm2 native tab integration depends on `-CC` specifically — regular `tmux` won't give the same UX.

**Recommendation:** Add a subsection to §8 or §9 documenting the tmux -CC flow:
```
If teammate_mode == "tmux" and $TMUX is not set:
  Launch via: tmux -CC new-session -- agent-launcher [flags]
  This enables iTerm2 control mode (native tabs/panes).
If already in tmux:
  Proceed directly (tmux panes spawn within existing session).
```

### Gap #2 (HIGH): `--dangerously-skip-permissions` Default Changed

claude-team **always** passes `--dangerously-skip-permissions` (hardcoded, lines 193/195).

The spec makes it per-agent with **default `false`** (§3 frontmatter field).

This is a **behavior change**. Anyone migrating from claude-team will find their agents now respect permissions by default. The orchestrator self-configuration (§8) lists it as an option but doesn't explicitly set it.

**Risk:** Migration breaks existing workflows. Users accustomed to claude-team's permissive mode will hit permission prompts unexpectedly.

**Recommendation:** Either:
- (a) Document the change explicitly in §10 migration table as a deliberate security improvement
- (b) Default to `true` for the orchestrator's own configuration in §8 (matching claude-team behavior), while keeping `false` for spawned agents
- (c) Add a `--dangerously-skip-permissions` global flag to the launcher that applies to ALL agents (matching claude-team's behavior)

### Gap #3 (MEDIUM): No `--no-interactive` Mode

claude-team has `--no-interactive` (line 86) for CI/scripting use, falling back to `$CLAUDE_TEAM_DEFAULT_MODE` or `auto`.

The spec requires `--team-name` but doesn't discuss a non-interactive flow for automated/CI usage. The `start` command assumes interactive use (gum picker as fallback).

**Recommendation:** Add a `--no-interactive` flag or document that CI usage should always pass explicit `--teammate-mode`.

### Gap #4 (MEDIUM): `CLAUDE_TEAM_DEFAULT_MODE` Env Var Not Carried Over

claude-team line 124: `TEAMMATE_MODE="${CLAUDE_TEAM_DEFAULT_MODE:-auto}"`

This lets users set a persistent default mode without passing flags every time. The spec has `AGENT_TEAM_NAME` env var but no mode equivalent.

**Recommendation:** Add `AGENT_TEAM_DEFAULT_MODE` or similar env var to §9 global flags table.

### Gap #5 (MEDIUM): No Passthrough Args

claude-team (lines 69, 91-93, 193/195) supports `-- CLAUDE_ARGS...` to pass arbitrary flags to the underlying `claude` binary (e.g., `ct --mode tmux -- --resume`).

The spec's CLI interface (§9) doesn't mention passthrough arguments.

**Recommendation:** Add a `[-- CLAUDE_ARGS...]` to the command syntax. This is important for power users and debugging.

### Gap #6 (LOW): No Dependency Checking

claude-team (lines 105, 131-133) checks for and offers to install `gum` and `tmux` via `check_and_install`.

The spec doesn't mention runtime dependency verification.

**Recommendation:** Add a prerequisites section or note that the `start` command should verify tmux availability before attempting tmux mode.

### Gap #7 (LOW): No `ct` Shorthand

claude-team is aliased as `ct` (a separate symlink). The spec doesn't mention short command names.

**Recommendation:** Consider whether the launcher needs a short alias. Lower priority for Phase 1.

### Gap #8 (LOW): No Help Text / Keyboard Controls Documentation

claude-team has detailed `--help` output (lines 25-64) including keyboard shortcuts (Shift+Up/Down, Ctrl+T, Shift+Tab, Escape, Enter).

The spec documents commands but not help text or keyboard controls.

**Recommendation:** Not critical for the spec, but the implementation should include comprehensive `--help` output.

---

## Contradictions / Risks

### Risk #1: Orchestrator Special-Casing

claude-team treats the orchestrator as the ONLY agent — it IS the session. The spec (§8) treats the orchestrator as special but also has it as a `.claude/agents/orchestrator.md` file alongside other agents.

Question: If `agent-launcher start` reads orchestrator.md and launches the lead session, what happens if someone runs `agent-launcher launch orchestrator`? Is the orchestrator both a launchable agent AND the lead? The spec should clarify that the orchestrator agent file is consumed by `start`, not by `launch`.

### Risk #2: `start` vs Existing `claude-team` Coexistence

During migration, both `claude-team` and `agent-launcher start` may exist. The spec §10 says "replaces" but doesn't discuss the transition period. Will both work? Will they conflict?

### Risk #3: Hook Message Content

claude-team's Stop hook says: "Any previously created team will be destroyed and must be recreated on next launch." The spec's hook (§8) says just "Session stopping." The warning about team destruction is important context for users and should be preserved.

---

## Summary

| Category | Count | Items |
|----------|-------|-------|
| COVERED | 11 | Core features well-mapped |
| IMPROVED | 1 | Orchestrator prompt now declarative |
| CHANGED | 1 | dangerously-skip-permissions default (Gap #2) |
| MISSING (HIGH) | 2 | tmux -CC details (#1), permissions default change (#2) |
| MISSING (MEDIUM) | 3 | --no-interactive (#3), default mode env (#4), passthrough args (#5) |
| MISSING (LOW) | 3 | Dependency checking (#6), ct alias (#7), help text (#8) |
| RISKS | 3 | Orchestrator dual-role, coexistence, hook messages |
| EXCLUDED | 1 | Settings backup (correct) |
| N/A | 1 | Bash strict mode |

**Overall:** The spec is solid and covers the major features. The two HIGH gaps (tmux -CC details and permissions default change) should be addressed before implementation begins. The MEDIUM gaps are quality-of-life features that can be added incrementally.
