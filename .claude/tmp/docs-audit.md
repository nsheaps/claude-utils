# Documentation Audit Report

**Auditor**: Tweety Bird (Technical Writer)
**Date**: 2026-02-15
**Scope**: All specs in `docs/specs/draft/`, skill files in `.claude/skills/agent-teams/`, scripts in `bin/`, and `README.md`

---

## 1. Internal Consistency

### Cross-spec agreement

The three specs (`3-script-architecture-plan.md`, `agent-orchestration.md`, `agent-team-project.md`) are **largely consistent** with each other. They share the same vision: a 3-layer architecture (`claude-team` -> `claude-team-orchestrator` -> `run-claude`) with clear separation of concerns.

**No contradictions found** between the specs on:
- The role of each script in the 3-layer split
- The flow of flags and env vars
- The principle that `run-claude` is the single launch point

### Minor inconsistency: `happy` vs `simple_claudeish`

- `agent-orchestration.md` (line 52) mentions `happy`/permission wrappers as part of `run-claude`'s responsibility
- `3-script-architecture-plan.md` correctly refers to `simple_claudeish` (which is what the code actually uses)
- The actual code in `run-claude` uses `simple_claudeish`, which calls `claude` directly (not `happy`)
- `claude.lib.sh` does have `happy` support via `claudeish()` / `CLAUDE_PREFERRED_BIN`, but `run-claude` explicitly uses `simple_claudeish`

**Recommendation**: `agent-orchestration.md` line 52 should say `simple_claudeish`/permission wrappers instead of `happy`/permission wrappers, or clarify that `happy` is the future/optional wrapper.

### Skill vs Specs consistency

The SKILL.md and specs agree on:
- The 3 teammate modes (auto, in-process, tmux)
- The 7 core primitives
- The experimental env var `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`
- Keyboard controls

---

## 2. Completeness

### TODOs and gaps found

| Location | Gap | Severity |
|----------|-----|----------|
| `agent-orchestration.md` line 84 | "Testing Methodology: TBD" — no acceptance criteria defined | Medium |
| `agent-team-project.md` lines 43-67 | All "Open Questions" are still open — no answers recorded | Low (expected for draft) |
| `agent-orchestration.md` lines 57-73 | "Open Research Questions" still open — no answers recorded | Low (expected for draft) |
| `3-script-architecture-plan.md` | No mention of error handling when `gum` is not available for the update check prompt | Low |
| `3-script-architecture-plan.md` line 128 | `claude_check_for_updates()` says "Prompts user with `gum confirm`" but current `run-claude` already uses `gum confirm` — this is fine, but worth noting that `gum` becomes a dependency for update checks, not just interactive mode selection | Low |

### Missing from 3-script-architecture-plan.md

1. **No mention of `happy` routing**: The current `claude.lib.sh` has `claudeish()` which routes to `happy` if available. The plan uses `simple_claudeish` which always calls `claude`. Should the orchestrator path eventually honor `CLAUDE_PREFERRED_BIN`? This is undocumented.

2. **No mention of `claude-team-worker`**: Referenced in MEMORY.md as "future, worker params (same pattern as orchestrator)" but the 3-script plan doesn't describe it. The plan title says "3-Script Architecture" so this may be intentional, but a forward reference would help.

3. **`--dangerously-skip-permissions` in current `claude-team`**: The plan correctly identifies this as a problem (line 35) but the implementation sequence doesn't explicitly call out removing `--dangerously-skip-permissions` from `claude-team`. It's implied by "Strip orchestration logic" but should be explicit.

### Missing from SKILL.md

1. **No mention of the 3-script architecture plan**: The skill references `claude-team` and `ct` but doesn't mention the planned refactor into `claude-team-orchestrator`. Since the plan is still draft, this is acceptable.

2. **No documentation of `CLAUDE_TEAM_DEFAULT_MODE` env var**: The `claude-team` script supports this (line 124), and the `show_help()` in `claude-team` documents it, but SKILL.md doesn't mention it.

---

## 3. Accuracy (Specs vs Code)

### `claude-team` (current code) vs 3-script-architecture-plan

The plan accurately describes the current state. Verified:

| Plan claim | Code reality | Match? |
|------------|-------------|--------|
| Calls `claude` directly, not `run-claude` | Line 193/195: `claude --dangerously-skip-permissions` | YES |
| Passes `--dangerously-skip-permissions` itself | Lines 193, 195 | YES |
| Calls `claude_check_settings_backup` itself | Lines 185-186 | YES |
| Uses `exec tmux -CC new-session` for tmux path | Line 193 | YES |
| Uses `command claude` for non-tmux path | Line 195 | YES |
| Builds `ORCHESTRATOR_PROMPT` inline | Lines 141 | YES |
| Builds `HOOKS_SETTINGS_JSON` inline | Lines 144-167 | YES |
| Builds `TEAM_FLAGS` array | Lines 170-176 | YES |
| Exports `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` | Line 178 | YES |

### `run-claude` (current code) vs specs

| Spec claim | Code reality | Match? |
|------------|-------------|--------|
| Has brew update check inline | Lines 36-47 | YES |
| Calls `simple_claudeish` | Line 53 | YES |
| Has settings backup + trap | Lines 49-51 | YES |
| No `--skip-update-check` flag yet | Correct, doesn't exist yet | YES (expected) |

### `claude.lib.sh` vs specs

| Spec claim | Code reality | Match? |
|------------|-------------|--------|
| No `claude_check_for_updates()` function yet | Correct, doesn't exist yet | YES (expected) |
| `simple_claudeish` adds `--allow-dangerously-skip-permissions` | Lines 100-106 | YES |
| `claude_check_settings_backup` exists | Lines 151-199 | YES |

### SKILL.md vs Code

| SKILL claim | Code/reality | Match? |
|-------------|-------------|--------|
| `--teammate-mode` is a hidden flag | Confirmed per SKILL.md sources | YES |
| `teammateMode` in settings.json prevents iTerm2 dialog | Confirmed per SKILL.md sources | YES |
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` enables feature | `claude-team` line 178 | YES |
| `claude-team` auto-launches `tmux -CC` | Lines 188-193 | YES |

### README.md vs Code

| README claim | Code reality | Match? |
|-------------|-------------|--------|
| `claude-team` described as "Launch Claude with agent teams enabled" | Correct | YES |
| `ct` described as "Shorthand alias for `claude-team`" | `bin/ct` line 34: `exec "$SCRIPT_DIR/claude-team" "$@"` | YES |
| Dependencies list: `fzf` and `claude` | Missing: `gum` is also a dependency (used by `claude-team` and `run-claude`) | **NO** |
| Dependencies list: no mention of `tmux` | tmux is optional but required for tmux mode | Acceptable (optional dep) |

### README inaccuracy: Missing `gum` dependency

The README lists `fzf` and `claude` as dependencies but does **not** list `gum`, which is used by:
- `claude-team` for interactive mode picker
- `run-claude` for `gum confirm` on brew update prompt

`gum` is auto-installed by `check_and_install` in `claude-team`, but `run-claude` assumes it's available without checking. This is a **code issue** more than a doc issue, but the README should list `gum` as a dependency.

---

## 4. Cross-references

### Links between docs

| From | Links to | Valid? |
|------|----------|--------|
| `3-script-architecture-plan.md` | `docs/specs/draft/agent-orchestration.md` | YES |
| `3-script-architecture-plan.md` | `docs/specs/draft/agent-team-project.md` | YES |
| `3-script-architecture-plan.md` | `.claude/skills/agent-teams/SKILL.md` | YES |
| `agent-orchestration.md` | `.claude/skills/agent-teams/SKILL.md` | YES |
| `agent-orchestration.md` | `.claude/skills/agent-teams/references/hooks-and-config.md` | YES |
| `agent-orchestration.md` | `memory/agent-teams-research.md` | **UNVERIFIED** — this path is relative and may not resolve correctly depending on context |
| `agent-team-project.md` | `docs/specs/draft/agent-orchestration.md` | YES |
| `agent-team-project.md` | `docs/specs/draft/3-script-architecture-plan.md` | YES |
| `agent-team-project.md` | `.claude/skills/agent-teams/SKILL.md` | YES |
| SKILL.md | `references/hooks-and-config.md` | YES (relative to skill dir) |

### External links

| URL | Likely valid? |
|-----|--------------|
| `https://code.claude.com/docs/en/agent-teams` | YES (official docs) |
| `https://code.claude.com/docs/en/hooks` | YES (official docs) |
| `https://modelcontextprotocol.io/` | YES (official MCP site) |
| `https://agentskills.io` | YES (agent skills standard) |
| `https://github.com/anthropics/claude-code/issues/24301` | YES (GitHub issue) |
| `https://github.com/anthropics/claude-code/issues/23527` | YES (GitHub issue) |
| `https://github.com/anthropics/claude-code/issues/24771` | YES (GitHub issue) |
| `https://github.com/anthropics/claude-code/issues/24292` | YES (GitHub issue) |
| `https://github.com/anthropics/claude-code/releases/tag/v2.1.33` | YES (GitHub release) |
| Various blog links in hooks-and-config.md | Likely valid |

### Suspicious reference

`agent-orchestration.md` line 80 references `memory/agent-teams-research.md`. This path is relative and assumes the reader's context is the project root. Should be `../../.claude/projects/-Users-nathan-heaps-src-nsheaps-claude-utils/memory/agent-teams-research.md` or simplified to a note like "See project memory for prior research findings."

---

## 5. Summary of Findings

### Issues requiring action

| # | Severity | Description | Location |
|---|----------|-------------|----------|
| 1 | Medium | README missing `gum` as a dependency | `README.md` |
| 2 | Low | `agent-orchestration.md` mentions `happy` where code uses `simple_claudeish` | `agent-orchestration.md` line 52 |
| 3 | Low | `memory/agent-teams-research.md` reference path may not resolve | `agent-orchestration.md` line 80 |
| 4 | Low | `CLAUDE_TEAM_DEFAULT_MODE` env var undocumented in SKILL.md | `.claude/skills/agent-teams/SKILL.md` |
| 5 | Low | Testing methodology still TBD in orchestration spec | `agent-orchestration.md` line 84 |
| 6 | Info | `run-claude` uses `gum confirm` without `check_and_install gum` guard | `bin/run-claude` line 44 |

### Overall assessment

The documentation is in **good shape** for draft-stage specs. The three specs are internally consistent and accurately reflect the current codebase. The SKILL.md is comprehensive and well-sourced. The main gaps are expected for draft status (open questions, TBD sections). The most actionable finding is the missing `gum` dependency in the README.
