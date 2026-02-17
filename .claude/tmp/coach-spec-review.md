# Coach Spec Review: 3-Script Architecture Plan

**Reviewer**: Wile E. Coyote (Team Coach)
**Date**: 2026-02-15
**Files Reviewed**:
- `docs/specs/draft/3-script-architecture-plan.md`
- `docs/specs/draft/agent-orchestration.md`
- `docs/specs/draft/agent-team-project.md`
- `.claude/skills/agent-teams/SKILL.md`
- Current source: `bin/claude-team`, `bin/run-claude`, `bin/lib/claude.lib.sh`, `bin/ct`, `test/cli-test.sh`

---

## Critical Issues

### 1. Permission Flag Behavior Change (HIGH RISK)

**Current**: `claude-team` passes `--dangerously-skip-permissions` directly to `claude`.
**Proposed**: `claude-team-orchestrator` delegates to `run-claude`, which uses `simple_claudeish` adding `--allow-dangerously-skip-permissions`.

These are **different flags** with different semantics:
- `--dangerously-skip-permissions` — skips all permission prompts
- `--allow-dangerously-skip-permissions` — allows the user to _opt into_ skipping via a separate mechanism

The plan's flag ownership table shows this intentionally, but **does not explicitly call out that this is a behavior change**. If the semantics differ, users may experience different permission prompting behavior after the refactor. This needs to be investigated and documented.

### 2. Missing Package/Distribution Updates

The plan creates a new file `bin/claude-team-orchestrator` but does not mention:
- Adding it to `package.json` `bin` field
- Adding it to the Homebrew formula
- Whether it needs to be in `$PATH` or can be invoked via `$SCRIPT_DIR` only

If it's only invoked via `$SCRIPT_DIR`, this may be fine — but the plan should explicitly state that it's an internal binary, not user-facing.

### 3. Formatting Bug in Current `run-claude` (Pre-existing)

`run-claude` line 40-41:
```bash
cat << EOF
Updates are available for the following formulae:"
$(echo "$AVAILABLE_UPDATES" | xargs -I{} echo " - local {} remote")
```

There's a stray `"` at the end of "formulae:" — this is a pre-existing bug but will be carried into the extracted `claude_check_for_updates()` function if not fixed during extraction.

---

## Gaps

### 4. No Help Text Design for `claude-team-orchestrator`

The plan specifies testing `claude-team-orchestrator --help` but doesn't design what the help text should say. Should it document `--mode`, `--skip-update-check` passthrough, or clarify it's an internal tool?

### 5. No `chmod +x` or Executable Permissions Mentioned

The plan doesn't mention making `claude-team-orchestrator` executable. Minor but easy to miss.

### 6. Orchestrator Error Handling

No mention of what happens if:
- `run-claude` is not found at `$SCRIPT_DIR/run-claude`
- `--mode` is not provided to the orchestrator
- The orchestrator is called directly by a user (not through `claude-team`)

The plan says `--mode` is REQUIRED but doesn't show error handling code.

### 7. `gum` Dependency for Update Check

The extracted `claude_check_for_updates()` will use `gum confirm`. When called from `claude-team`, gum may not be installed yet (it's only `check_and_install`ed when the interactive picker runs). The function should either:
- Call `check_and_install gum` itself, or
- Fall back to a non-gum prompt, or
- Require gum as a precondition

### 8. Testing Strategy is Thin

The plan adds 7 test cases, but they're all `--help` and invalid-input tests. Missing:
- **Flag stripping test**: Verify `--skip-update-check` is consumed by `run-claude` and not passed to `claude`
- **Integration test**: Verify the full chain `claude-team` -> `claude-team-orchestrator` -> `run-claude` produces the correct `claude` invocation
- **Env var inheritance test**: Verify `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is present in the final `claude` process

### 9. `agent-orchestration.md` Has "TBD" Testing Section

"Testing Methodology: TBD — will define acceptance criteria once architecture is approved." This should be resolved before or during implementation, not left indefinitely.

---

## Ambiguities

### 10. Is `--continue` Always Desired?

`TEAM_FLAGS` includes `--continue` hardcoded. The plan doesn't discuss whether users might NOT want `--continue` for a team session. Is this always the correct behavior? Should it be configurable?

### 11. Direct `claude-team-orchestrator` Invocation

If a user calls `claude-team-orchestrator --mode tmux` directly (bypassing `claude-team`):
- No update check happens
- No tmux -CC launch happens
- The user must be in a tmux session already (or tmux mode won't work as expected)

Is this a supported use case or should the orchestrator guard against it?

### 12. Parameterization of Orchestrator Config

`ORCHESTRATOR_PROMPT`, `HOOKS_SETTINGS_JSON`, and hardcoded flags are string literals. The plan doesn't discuss whether these should be:
- Configurable via env vars or files
- Extensible for the future `claude-team-worker` script
- Kept as constants (simplest approach)

---

## Risks

### 13. Brew Update Check Timing in Team Path

Currently: Update check happens inline in `run-claude` (after settings backup setup).
Proposed: Update check happens in `claude-team` BEFORE tmux launch.

If the user declines the update, does the tmux session still start? (Likely yes, since the check is not fatal — but this should be confirmed.)

### 14. Process Replacement Chain

All three scripts use `exec` to replace themselves:
```
claude-team --exec--> tmux/orchestrator --exec--> run-claude --???--> claude
```

But `run-claude` does NOT use `exec` for `simple_claudeish` — it calls `command claude`. This means `run-claude`'s EXIT trap for `claude_check_settings_backup` will fire when claude exits. This is correct and intentional, but the difference from the other two scripts (which DO use exec) should be documented.

### 15. `run-claude` Help Text Discrepancy (Pre-existing)

`run-claude` header comment says "Launch Claude Code with bypass permissions through happy" but `simple_claudeish` always invokes `claude`, not `happy`. The `claudeish()` function routes to `happy` but `simple_claudeish` bypasses this routing entirely. This is a pre-existing inconsistency.

---

## Items That Don't Block Implementation

- `agent-team-project.md` open questions about MCP interface — these are future work
- Research questions in `agent-orchestration.md` — acknowledged as open
- Worker script (`claude-team-worker`) — explicitly listed as future

---

## Summary

| Category | Count | Blocking? |
|----------|-------|-----------|
| Critical Issues | 3 | #1 (permission flag) needs investigation before implementation |
| Gaps | 6 | #7 (gum dep) and #8 (testing) should be addressed in plan |
| Ambiguities | 3 | #10 (`--continue`) worth a decision before implementation |
| Risks | 3 | #14 (exec chain) should be documented |

**Recommendation**: The plan is well-structured and thorough. Before implementation, resolve:
1. The `--dangerously-skip-permissions` vs `--allow-dangerously-skip-permissions` behavior change (Critical #1)
2. Decide if `claude-team-orchestrator` is user-facing or internal-only (Gap #4 / Ambiguity #11)
3. Address `gum` dependency in the extracted update check function (Gap #7)
