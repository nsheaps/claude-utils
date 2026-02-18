# Research: Claude Code `--maintenance` Flag and Useful CLI Flags for Agent Teams

**Researcher**: Road Runner (Deep Researcher)
**Date**: 2026-02-18
**Question**: What does the `--maintenance` flag do, and what other CLI flags could help with team orchestration?

## Answer

`--maintenance` triggers **Setup hooks** and exits — it is NOT a rate-limiting or reduced-activity mode. It's a lifecycle hook mechanism for running maintenance scripts (dependency updates, cache clearing, health checks) without starting an interactive session. Separately, several lesser-known CLI flags are highly relevant to agent team orchestration.

## 1. The `--maintenance` Flag

### What It Does

From the [official CLI reference](https://code.claude.com/docs/en/cli-reference):

> `--maintenance` — Run maintenance hooks and exit

It triggers hooks configured under the **Setup** hook event with the matcher `"maintenance"`, executes them, and exits. No interactive session starts.

### How It Works

The Setup hook event (added ~January 25, 2026) is a special hook type that runs **before** a Claude Code session starts. It supports three CLI triggers:

| Flag | Matcher | Behavior |
|:-----|:--------|:---------|
| `--init` | `"init"` | Run setup hooks, then start interactive session |
| `--init-only` | `"init"` | Run setup hooks, then exit (no session) |
| `--maintenance` | `"maintenance"` | Run maintenance hooks, then exit (no session) |

### Configuration

```json
{
  "hooks": {
    "Setup": [
      {
        "matcher": "init",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/setup-init.sh"
          }
        ]
      },
      {
        "matcher": "maintenance",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/maintenance.sh"
          }
        ]
      }
    ]
  }
}
```

### Hook Input/Output

Scripts receive JSON via stdin (standard hook input fields) and should output:
```json
{
  "hookSpecificOutput": {
    "hookEventName": "Setup",
    "additionalContext": "Human-readable status message"
  }
}
```

### Is It a Session Flag or Global Setting?

**It's a CLI flag** — not a global setting. It runs per-invocation. The hooks themselves are configured in settings files (user, project, or local scope).

**Confidence**: High — verified from [official CLI reference](https://code.claude.com/docs/en/cli-reference) and [claudefast Setup hooks guide](https://claudefa.st/blog/tools/hooks/claude-code-setup-hooks).

### Could It Be Used for Agent Rate Limiting?

**No, not directly.** `--maintenance` runs hooks and exits. It doesn't put agents into a reduced-activity mode.

However, for agent teams, it could be used for:

1. **Pre-session health checks**: Run `claude --maintenance` before spawning agents to verify environment health
2. **Dependency updates**: Update tools/dependencies that agents will use
3. **Cache management**: Clear stale caches before a team session
4. **Post-session cleanup**: Run after a team session ends to clean up artifacts

For **rate limiting** specifically, these are more relevant approaches:
- `--max-budget-usd` — Hard cost cap per agent (print mode only)
- `--max-turns` — Limit agentic turns per agent (print mode only)
- TeammateIdle hooks — Quality gate before an agent goes idle

**Confidence**: High — `--maintenance` is definitively not a rate-limiting feature.

## 2. Official Hooks Reference Gap

**Important finding**: The [official hooks reference](https://code.claude.com/docs/en/hooks) does NOT list "Setup" as a hook event. The 14 documented events are: SessionStart, UserPromptSubmit, PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure, Notification, SubagentStart, SubagentStop, Stop, TeammateIdle, TaskCompleted, PreCompact, SessionEnd.

However, `--init`, `--init-only`, and `--maintenance` ARE listed in the [CLI reference](https://code.claude.com/docs/en/cli-reference), confirming the feature exists. The Setup hook event appears to be a newer addition that hasn't been fully documented in the hooks reference yet.

**Confidence**: Medium-High — the CLI flags exist and work, but the hooks reference has a documentation gap.

## 3. Other Useful CLI Flags for Team Orchestration

### High Relevance for Agent Teams

| Flag | Description | Team Use Case |
|:-----|:-----------|:-------------|
| `--agent <name>` | Specify an agent for the session | Assign role-specific agents to each teammate |
| `--agents <json>` | Define custom subagents dynamically via JSON | Inline agent definitions without agent files |
| `--teammate-mode <mode>` | `auto`, `in-process`, or `tmux` | Control how teammates render |
| `--permission-mode <mode>` | `default`, `plan`, `acceptEdits`, `dontAsk`, `bypassPermissions` | Set per-agent permission levels |
| `--allow-dangerously-skip-permissions` | Enable bypass as option without activating | Compose with `--permission-mode` for fine-grained control |
| `--append-system-prompt <text>` | Append to system prompt | Inject role instructions, team rules per agent |
| `--settings <path\|json>` | Load additional settings | Per-agent hook configs, tool restrictions |
| `--max-turns <n>` | Limit agentic turns (print mode) | Prevent runaway agents |
| `--max-budget-usd <n>` | Cost cap per session (print mode) | Budget control per agent |
| `--mcp-config <path>` | Load MCP servers from JSON | Per-agent MCP server configs |
| `--strict-mcp-config` | Only use specified MCP servers | Isolate agent MCP access |

### Medium Relevance

| Flag | Description | Team Use Case |
|:-----|:-----------|:-------------|
| `--add-dir <paths>` | Add additional working directories | Give agents access to specific repos/dirs |
| `--tools <list>` | Restrict available tools | Role-specific tool restrictions (e.g., researcher can't Write) |
| `--allowedTools <patterns>` | Auto-approve specific tools | Reduce permission prompts for known-safe operations |
| `--disallowedTools <list>` | Remove tools from context | Prevent agents from using certain tools |
| `--continue`, `-c` | Load most recent conversation | Resume agent sessions after crashes |
| `--resume`, `-r` | Resume by session ID or name | Resume specific agent sessions |
| `--fork-session` | Create new session from resume point | Branch from a checkpoint |
| `--session-id <uuid>` | Use specific session ID | Deterministic session management |
| `--disable-slash-commands` | Disable all skills/commands | Reduce agent distraction |
| `--plugin-dir <path>` | Load plugins for this session | Per-agent plugin configs |
| `--debug <categories>` | Debug logging with category filter | `"api,hooks"`, `"!statsig,!file"` — targeted debugging |
| `--verbose` | Full turn-by-turn output | Agent monitoring |
| `--fallback-model <model>` | Auto-fallback on overload (print mode) | Rate limit resilience |

### Lower Relevance but Notable

| Flag | Description | Team Use Case |
|:-----|:-----------|:-------------|
| `--from-pr <number>` | Resume sessions linked to a PR | PR-based agent workflows |
| `--remote` | Create web session on claude.ai | Remote/distributed agent work |
| `--teleport` | Resume web session locally | Bring remote work local |
| `--betas <headers>` | Include beta API headers | Access experimental features |
| `--no-session-persistence` | Don't save sessions (print mode) | Ephemeral agent tasks |
| `--setting-sources <list>` | Choose which settings to load | Override settings resolution |
| `--chrome` | Enable browser integration | Web automation agents |
| `--json-schema <schema>` | Structured JSON output (print mode) | Machine-readable agent output |

## 4. The `--agents` Flag — Inline Agent Definitions

This flag deserves special attention. It allows defining custom subagents as JSON without agent files:

```bash
claude --agents '{
  "code-reviewer": {
    "description": "Expert code reviewer. Use proactively after code changes.",
    "prompt": "You are a senior code reviewer.",
    "tools": ["Read", "Grep", "Glob", "Bash"],
    "model": "sonnet"
  },
  "debugger": {
    "description": "Debugging specialist for errors and test failures.",
    "prompt": "You are an expert debugger."
  }
}'
```

**Agent definition fields:**

| Field | Required | Description |
|:------|:---------|:-----------|
| `description` | Yes | When the subagent should be invoked |
| `prompt` | Yes | System prompt for the subagent |
| `tools` | No | Array of allowed tools (inherits all if omitted) |
| `disallowedTools` | No | Array of denied tools |
| `model` | No | `sonnet`, `opus`, `haiku`, or `inherit` |
| `skills` | No | Array of skill names to preload |
| `mcpServers` | No | Array of MCP servers for this subagent |
| `maxTurns` | No | Max agentic turns before stop |

**Relevance to agent-team**: This could be used by the launcher to define per-agent subagent configurations without needing to write agent markdown files. Particularly useful for dynamic team compositions.

## 5. Recommended Combinations for Agent Team Launcher

### Orchestrator Launch Pattern

```bash
CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 claude \
  --continue \
  --permission-mode delegate \
  --teammate-mode tmux \
  --append-system-prompt "You are an orchestrator..." \
  --settings '{"hooks":{...}}' \
  --max-budget-usd 50.00
```

### Worker Launch Pattern (if custom launcher manages spawning)

```bash
claude \
  --agent worker-role \
  --permission-mode bypassPermissions \
  --tools "Read,Write,Edit,Bash,Grep,Glob" \
  --append-system-prompt "You are a $ROLE on team $TEAM..." \
  --settings "$WORKER_SETTINGS_JSON" \
  --max-turns 100 \
  --max-budget-usd 10.00
```

### Pre-Session Maintenance

```bash
claude --maintenance  # Run maintenance hooks (deps, health checks)
claude --init-only    # Run init hooks (environment setup) and exit
```

## Open Questions

1. **Is the Setup hook event fully supported?** The CLI flags exist and third-party docs describe it, but the official hooks reference doesn't list it. Could be a documentation gap or a feature still in beta.
2. **Can `--max-budget-usd` and `--max-turns` work in interactive mode?** Currently documented as print-mode-only. If they're enforced in interactive mode too, they'd be ideal for agent budget control.
3. **How does `--fallback-model` interact with agent teams?** If the primary model is overloaded, would all teammates fall back simultaneously? Could cause quality variance.

## Confidence Levels

| Finding | Confidence |
|:--------|:-----------|
| `--maintenance` runs maintenance hooks and exits | High — official CLI reference |
| Setup hook event exists with init/maintenance matchers | Medium-High — CLI reference + third-party docs, but not in official hooks reference |
| `--maintenance` is NOT a rate-limiting mechanism | High |
| `--agents` flag allows inline agent JSON definitions | High — official CLI reference |
| `--max-budget-usd` and `--max-turns` are print-mode-only | High — official docs |
| `--fallback-model` could help with rate limit resilience | Medium — documented but team interaction unclear |

## Sources

- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference) — official, complete flag listing including `--maintenance`, `--init`, `--init-only`
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) — official, 14 hook events (Setup NOT listed)
- [Claude Code Setup Hooks Guide](https://claudefa.st/blog/tools/hooks/claude-code-setup-hooks) — third-party detailed guide on Setup hooks
- [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams) — official agent teams documentation
- [Claude Code Permissions](https://code.claude.com/docs/en/permissions) — permission modes reference
- [Claude Code Settings](https://code.claude.com/docs/en/settings) — settings file resolution and scopes
- [Claude Code Changelog](https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md) — version history
- [Execution Control Flags (DeepWiki)](https://deepwiki.com/FlorianBruniaux/claude-code-ultimate-guide/14.2-execution-control-flags) — community reference
