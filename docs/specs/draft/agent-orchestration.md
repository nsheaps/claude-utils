# Agent Orchestration Service

**Status**: Draft
**Created**: 2026-02-13
**Author**: Nathan Heaps (via Claude Code session)

## Vision

A service that manages the launch of Claude Code agents across multiple orchestration patterns, building on Claude Code's agent teams feature.

## User Story

As a developer using Claude Code agent teams, I want a layered launch architecture so that:
- Infrastructure concerns (tmux, iTerm2) are separated from orchestration logic
- All agent launches route through a single entry point (`run-claude`) for consistent behavior (e.g., permission wrappers like `happy`, brew update checks, settings backup)
- Teammate launches can be customized (not just raw binary invocations)

## Orchestration Modes

### Mode 1: Independent Process Orchestrator
Each agent is an independent process or container. The orchestrator manages lifecycle, communication, and coordination across isolated agents.

### Mode 2: Nested Orchestrator with Internal Teammates
Each agent is itself an orchestrator that can use Claude Code's built-in teammate spawning to parallelize tasks internally. The outer orchestrator coordinates between these inner orchestrators.

### Shared Foundation
Both modes build on sub-agents within the same session for:
- Context preservation
- Focused execution
- Parallelization within a session

## Immediate Architecture: 3-Script Split

### Current State
`claude-team` does everything: tmux detection, mode selection, env vars, orchestrator flags, and launching claude directly.

### Proposed State

```
claude-team (infra)
  ├── tmux -CC launch path → claude-team-orchestrator (inside tmux)
  └── non-tmux path → claude-team-orchestrator (direct)

claude-team-orchestrator (orchestrator config)
  └── run-claude (central launch point)
```

| Script | Responsibility |
|--------|---------------|
| `bin/claude-team` | Infrastructure: tmux detection, tmux -CC launch, iTerm2 control mode, gum interactive mode picker |
| `bin/claude-team-orchestrator` | Orchestrator config: `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`, `--teammate-mode`, `--permission-mode delegate`, `--append-system-prompt`, `--settings` (hooks JSON), `--continue` |
| `bin/run-claude` | Central launch: `happy`/permission wrappers, brew update checks, settings backup, `simple_claudeish` |

### Why This Matters
If `run-claude` is later updated (e.g., reintroducing `happy` wrapper, adding telemetry, changing permission model), all launch paths — including agent team orchestrators — automatically pick up the changes.

## Open Research Questions

### Teammate Launch Customizability
- When Claude Code spawns a teammate (via `TeamCreate` / teammate spawning), does it invoke the `claude` binary directly?
- Can the teammate spawn command be customized or wrapped?
- If `run-claude` wraps claude with `happy`, will teammates also go through `happy`? (Likely no — they probably call the binary directly)
- What environment variables are inherited by teammates?

### tmux Integration Internals
- How does Claude Code create tmux panes for teammates?
- Can the pane creation command be intercepted or customized?
- Does `BackendRegistry` expose any configuration for spawn commands?

### MCP Server Feasibility
- Can the 7 core primitives (TeamCreate, TaskCreate, TaskUpdate, TaskList, Task, SendMessage, TeamDelete) be reimplemented as MCP tools?
- What internal state does Claude Code maintain for teams that would need to be replicated?
- Are there undocumented APIs or IPC mechanisms between lead and teammates?

## References

- [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
- `.claude/skills/agent-teams/SKILL.md` — comprehensive skill reference
- `.claude/skills/agent-teams/references/hooks-and-config.md` — hook/config details
- `memory/agent-teams-research.md` — prior research findings

## Testing Methodology

TBD — will define acceptance criteria once architecture is approved and research questions are answered.
