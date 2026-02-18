# Research: Orchestrator Permission Restriction via Hooks

**Researcher**: Road Runner (Deep Researcher)
**Date**: 2026-02-18
**Question**: Can PreToolUse hooks block specific tools for the orchestrator while allowing teammates full access? How do delegate mode and bypass permissions interact for leads vs spawned teammates?

## Executive Summary

**Yes, PreToolUse hooks CAN block specific tools for the orchestrator** — and this is currently the **only reliable mechanism** for restricting the lead while keeping teammates unrestricted. The built-in `--permission-mode delegate` is broken for agent teams (confirmed bugs #25037, #24307, #24073): it propagates tool restrictions to ALL spawned teammates, making them unable to read, write, or edit files. A hook-based approach avoids this because hooks are scoped to the session where they're defined — teammate sessions spawned in separate tmux panes do NOT inherit the lead's hooks.

## 1. The Delegate Mode Problem (Confirmed Bugs)

### What Delegate Mode Does

From the [official permissions reference](https://code.claude.com/docs/en/permissions):

> "Delegate Mode: Coordination-only mode for agent team leads. Restricts the lead to team management tools."

When active, the lead can only use: `SendMessage`, `TaskCreate`, `TaskUpdate`, `TaskList`, `TaskGet`, `TeamCreate`, `TeamDelete`, `Task` (spawning). File tools (`Read`, `Write`, `Edit`, `Bash`, `Glob`, `Grep`) are removed.

### The Bug: Restrictions Cascade to Teammates

Three separate issues confirm the same bug:

| Issue | Status | Platform | Reporter |
|:------|:-------|:---------|:---------|
| [#25037](https://github.com/anthropics/claude-code/issues/25037) | CLOSED | macOS | tarurar |
| [#24307](https://github.com/anthropics/claude-code/issues/24307) | OPEN (dup of #24073) | macOS | coygeek |
| [#24073](https://github.com/anthropics/claude-code/issues/24073) | OPEN | Linux/WSL2 | kyzzen |

**Root cause** (from #24073):
> "The permission model computes `effective_permissions = min(mode_param, lead_session_state)` rather than `effective_permissions = mode_param`. The lead's Delegate Mode acts as a ceiling on what permissions can be granted to children."

**Evidence**: Even passing `mode: "bypassPermissions"` on the Task call does NOT override the restriction. Teammates still lose all file tools.

**Workaround**: Spawn all teammates BEFORE entering delegate mode. Teammates spawned before the mode switch retain full tool access. This fails for mid-session spawning (adaptive respawn, adding roles).

**Confidence**: High — 3 independent reproductions across macOS and Linux, with detailed session evidence.

### Why Delegate Mode Can't Be Used Today

For our use case (orchestrator restricted, teammates unrestricted), delegate mode is fundamentally broken:

1. **Tool propagation**: Lead's restrictions cascade to all children
2. **`mode: "bypassPermissions"` ignored**: The Task tool's mode parameter can't override the lead's session state
3. **No mid-session spawning**: The spawn-before-delegate workaround fails for dynamic teams
4. **Undocumented behavior**: Issues #14297 and #15194 note that delegate mode behavior isn't fully documented

## 2. PreToolUse Hooks: The Working Alternative

### How PreToolUse Hooks Work

From the [official hooks reference](https://code.claude.com/docs/en/hooks):

**PreToolUse** fires before every tool invocation. The hook receives JSON on stdin:

```json
{
  "session_id": "abc-123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/project/dir",
  "permission_mode": "bypassPermissions",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": { "command": "ls -la", "description": "list files" },
  "tool_use_id": "toolu_xyz"
}
```

**The hook can block the tool** by returning:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "reason": "Orchestrator is restricted from using file tools. Delegate to a teammate."
  }
}
```

### Matcher Patterns

Matchers filter which tool invocations trigger the hook:

| Matcher | Matches |
|:--------|:--------|
| `"Bash"` | Only Bash tool calls |
| `"Read\|Edit\|Write"` | Read, Edit, or Write (regex OR) |
| `".*"` | All tool calls |
| `""` (empty) | All tool calls |

**Confidence**: High — official documentation with explicit examples.

### Decision Values

| Value | Effect |
|:------|:-------|
| `"allow"` | Approve without user prompt |
| `"deny"` | Block the tool call, display reason |
| `"ask"` | Prompt user for approval |
| (omitted) | Continue to next hook or default behavior |

### Why Hooks Don't Propagate to Teammates

**Critical architecture detail**: Hooks are defined in settings files. When Claude Code spawns a teammate in a new tmux pane, it launches a fresh `claude` process. That process loads its OWN settings — it does NOT inherit the lead's in-memory hook state.

This means:
- If hooks are in `.claude/settings.json` → ALL agents (lead + teammates) get them
- If hooks are passed via `--settings '{...}'` on the lead's launch command → ONLY the lead gets them
- If hooks are in a skill/agent definition → scoped to that component's lifecycle

**This is the key insight**: By passing the restrictive hooks via `--settings` on the lead's command line (not in the project settings file), only the lead is restricted. Teammates spawned later get the project-level settings (which don't have the restriction).

**Confidence**: High — hooks are file/settings-based, not inherited via process spawning.

## 3. Proposed Hook-Based Orchestrator Restriction

### Architecture

```
┌─────────────────────────────────────────────┐
│ Lead (Orchestrator)                          │
│ Launched with: --settings '{"hooks":{...}}'  │
│ PreToolUse hook BLOCKS: Bash, Read, Write,   │
│   Edit, Glob, Grep, WebFetch, WebSearch      │
│ ALLOWS: Task, TaskCreate, TaskUpdate,        │
│   TaskList, TaskGet, TeamCreate, TeamDelete,  │
│   SendMessage, AskUserQuestion, EnterPlanMode│
├─────────────────────────────────────────────┤
│ Teammates (spawned via tmux split)           │
│ NO restrictive hooks (normal settings only)  │
│ Full tool access: Bash, Read, Write, Edit,   │
│   Glob, Grep, etc.                           │
└─────────────────────────────────────────────┘
```

### Implementation: Hook Script

`.claude/hooks/restrict-orchestrator.sh`:

```bash
#!/bin/bash
# Restrict orchestrator to coordination-only tools
# This hook should ONLY be loaded by the lead's --settings flag

INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name')

# Tools the orchestrator IS allowed to use
ALLOWED_TOOLS="Task|TaskCreate|TaskUpdate|TaskList|TaskGet|TaskOutput|TeamCreate|TeamDelete|SendMessage|AskUserQuestion|EnterPlanMode|ExitPlanMode|Skill|ToolSearch|Read"

if echo "$TOOL_NAME" | grep -qE "^($ALLOWED_TOOLS)$"; then
  # Allow — output nothing or explicit allow
  echo '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"allow"}}'
else
  # Deny — orchestrator should delegate this work
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"reason\":\"Orchestrator restricted: use SendMessage to delegate '$TOOL_NAME' to a teammate.\"}}"
fi

exit 0
```

**Note**: `Read` is in the allowed list because the orchestrator may need to read task outputs, team configs, and research files. If stricter isolation is desired, it can be removed.

### Implementation: Lead Launch Command

```bash
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude \
  --continue \
  --dangerously-skip-permissions \
  --teammate-mode tmux \
  --append-system-prompt "You are an orchestrator. You MUST delegate all implementation work to teammates. Do NOT use file tools directly." \
  --settings '{
    "hooks": {
      "PreToolUse": [
        {
          "matcher": "",
          "hooks": [
            {
              "type": "command",
              "command": ".claude/hooks/restrict-orchestrator.sh"
            }
          ]
        }
      ]
    }
  }'
```

The `--settings` JSON is **merged** with project settings, so other settings (MCP servers, etc.) from `.claude/settings.json` still apply. Only the hooks are added.

### Why `--dangerously-skip-permissions` Is Still Needed

Even with PreToolUse hook restrictions on the lead:
- Teammates need `--dangerously-skip-permissions` (or equivalent) to work without prompts
- The lead's `--dangerously-skip-permissions` flag DOES propagate to teammates (unlike delegate mode restrictions, which are the bug)
- The hook enforces the restriction on the lead; bypass permissions ensures teammates can work freely

**Important semantic distinction**:
- `--dangerously-skip-permissions` = "Don't ask for permission" (auto-approve)
- `--permission-mode delegate` = "Restrict available tools" (remove tools)
- PreToolUse hook with `deny` = "Block specific tools after matching" (per-invocation denial)

The hook approach + bypass permissions gives us: Lead has all tools visible but blocked by hook, teammates have all tools visible and auto-approved.

**Confidence**: High — this follows directly from the documented hook behavior and settings inheritance model.

## 4. Alternative Approaches Considered

### 4.1 `--disallowedTools` CLI Flag

```bash
claude --disallowedTools "Bash,Edit,Write,Glob,Grep"
```

**Pros**: Simple, built-in
**Cons**:
- Removes tools from context entirely — the orchestrator can't even reference them in instructions to teammates
- Unknown propagation behavior to teammates (likely same as delegate mode)
- Less flexible than hooks (can't have conditional logic)

**Verdict**: Risky — may propagate to teammates like delegate mode does.

### 4.2 Permission Deny Rules in Settings

```json
{
  "permissions": {
    "deny": ["Bash", "Edit", "Write"]
  }
}
```

**Pros**: Declarative, no scripts needed
**Cons**:
- If in `.claude/settings.json`, applies to ALL agents including teammates
- If in `--settings`, only applies to lead (same scoping as hooks)
- Less flexible than hooks — no conditional logic, no custom deny messages

**Verdict**: Viable but less informative than hooks. The deny message from hooks helps the orchestrator understand WHY it was blocked and what to do instead.

### 4.3 Spawn Before Delegate (Workaround)

As described in issue #24073's workaround:

```
TeamCreate → Spawn ALL teammates → Enter Delegate Mode → Coordinate only
```

**Pros**: Uses built-in delegate mode
**Cons**:
- Can't spawn new teammates mid-session
- Can't adaptive-respawn failed agents
- Fragile ordering dependency
- Delegate mode is still "broken" — just worked around

**Verdict**: Not viable for production orchestration. Too fragile.

### 4.4 Agent Definition with Restricted Tools

```json
{
  "description": "Orchestrator agent",
  "prompt": "You are an orchestrator...",
  "tools": ["Task", "SendMessage", "TaskCreate", "TaskUpdate", "TaskList", "TaskGet", "TeamCreate", "AskUserQuestion"]
}
```

If using `--agent orchestrator` with a custom agent definition, the `tools` array restricts available tools.

**Pros**: Clean, declarative, scoped to the agent
**Cons**:
- Agent definitions are for SUBAGENTS, not the top-level lead
- The lead's tool set is controlled by permission mode, not agent definitions
- May not apply when the lead IS the top-level interactive session

**Verdict**: Only works if the orchestrator is itself a subagent. Not viable for the top-level lead.

## 5. Interaction Matrix: Permission Modes × Mechanisms

| Mechanism | Lead Restricted? | Teammates Restricted? | Mid-Session Spawn? | Custom Deny Message? |
|:----------|:----------------|:---------------------|:-------------------|:--------------------|
| `--permission-mode delegate` | Yes | **YES (BUG)** | No (broken) | No |
| PreToolUse hook (via `--settings`) | Yes | No | Yes | Yes |
| `--disallowedTools` | Yes | Unknown (likely yes) | N/A | No |
| Permission deny rules (via `--settings`) | Yes | No | Yes | No |
| Spawn-before-delegate workaround | Yes | No (if spawned first) | No | No |
| Agent definition `tools` array | Yes (subagents only) | No | Yes | No |

**Recommended**: PreToolUse hook via `--settings` — it's the only approach that checks all boxes.

## 6. Edge Cases and Risks

### 6.1 Hook Execution Overhead

Every tool call by the lead runs through the hook script. For a coordination-only orchestrator, tool calls are infrequent (mostly Task, SendMessage), so overhead is minimal. The script is a simple `jq` + `grep` — sub-millisecond execution.

### 6.2 Hook Failure Behavior

From the docs: If a hook script exits with non-zero status, the tool call proceeds as if the hook wasn't there (fail-open). To make it fail-closed, the script must always exit 0 and explicitly output a deny decision.

### 6.3 Teammate Settings Inheritance

Teammates inherit settings from the project-level `.claude/settings.json`, NOT from the lead's `--settings` override. This is by design for our approach — but it means any hooks in `.claude/settings.json` WILL apply to teammates too.

**Mitigation**: Keep the orchestrator restriction hook ONLY in the `--settings` CLI flag, never in the project settings file.

### 6.4 `--settings` Merge Behavior

The `--settings` flag merges with (not replaces) other settings sources. If `.claude/settings.json` also has PreToolUse hooks, both the project hooks AND the CLI hooks will run. The hook system runs all matching hooks in order.

### 6.5 Read Tool for Orchestrator

The orchestrator likely needs `Read` to:
- Check teammate output files (`.claude/tmp/*.md`)
- Read team config (`.claude/teams/*/config.json`)
- Read task details and research reports

Blocking `Read` would make the orchestrator unable to review work. **Recommendation**: Allow `Read` for the orchestrator. The hook script above includes it in the allow list.

## 7. Recommended Implementation for claude-team Launcher

### Phase 1: Basic Hook-Based Restriction

1. Create `.claude/hooks/restrict-orchestrator.sh` (see Section 3)
2. Modify `bin/claude-team` to pass `--settings` with the hook config when launching the orchestrator
3. Ensure teammates are spawned WITHOUT the restrictive hook (they use project settings only)

### Phase 2: Configurable Restriction

1. Make the allowed tools list configurable (env var or config file)
2. Add a `--restrict-lead` flag to `claude-team` that enables/disables the hook
3. Support different restriction profiles (e.g., "coordination-only", "read-only", "full-access")

### Phase 3: Monitor Delegate Mode Fix

Watch issues #24073 and #24307 for upstream fixes. When delegate mode properly scopes restrictions to the lead only, the hook-based approach can be replaced with the simpler `--permission-mode delegate`.

## Open Questions

1. **Does `--disallowedTools` propagate to teammates?** Not confirmed. If it doesn't, it's a simpler alternative to hooks for basic restriction.
2. **Can hooks access the session type (lead vs teammate)?** If SessionStart input includes `is_lead` or similar, a single hook in project settings could conditionally restrict only the lead.
3. **Will Anthropic fix delegate mode?** Issue #25037 is CLOSED (may be fixed), but #24073 and #24307 are still OPEN. The fix status is unclear.
4. **What about `--allowedTools`?** The docs mention it's ignored for built-in tools — unclear if this limitation affects the whitelist approach.

## Confidence Levels

| Finding | Confidence |
|:--------|:-----------|
| Delegate mode propagates restrictions to teammates (bug) | High — 3 independent reproductions |
| `mode: "bypassPermissions"` on Task call doesn't override delegate | High — explicitly tested in issues |
| PreToolUse hooks can deny specific tools | High — official docs with examples |
| Hooks in `--settings` don't propagate to teammates | High — settings inheritance model is file-based |
| Hook-based orchestrator restriction is viable | High — follows directly from documented behavior |
| `Read` should be allowed for orchestrator | Medium-High — practical need, but depends on workflow |
| `--disallowedTools` propagation behavior | Low — not tested or documented for teams |
| Delegate mode fix timeline | Low — #25037 closed but #24073/#24307 still open |

## Sources

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) — PreToolUse input/output schema, matcher patterns, permissionDecision values
- [Claude Code Permissions Reference](https://code.claude.com/docs/en/permissions) — delegate mode description, permission rules, tool restriction mechanisms
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) — `--settings`, `--disallowedTools`, `--allowedTools`, `--permission-mode` flags
- [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams) — teammate permission inheritance: "Teammates start with the lead's permission settings"
- [GitHub #25037](https://github.com/anthropics/claude-code/issues/25037) — Delegate mode breaks agent teams (CLOSED, detailed repro with 5 failed spawns)
- [GitHub #24307](https://github.com/anthropics/claude-code/issues/24307) — Teammates in delegate mode have no file access despite bypassPermissions (OPEN, duplicate of #24073)
- [GitHub #24073](https://github.com/anthropics/claude-code/issues/24073) — Teammates spawned in delegate mode lose tool access (OPEN, root cause hypothesis)
- [GitHub #14297](https://github.com/anthropics/claude-code/issues/14297) — Delegate mode is undocumented
- [GitHub #5465](https://github.com/anthropics/claude-code/issues/5465) — Task subagents fail to inherit permissions in MCP server mode (related class of bug)
