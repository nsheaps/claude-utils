# Agent Team: Provider-Agnostic Orchestration

**Status**: Draft
**Created**: 2026-02-13

## Vision

Extract `claude-team` into a standalone "agent-team" project that orchestrates multi-agent workflows. Initially uses Claude Code as the agent runtime, but designed so the orchestration layer is provider-agnostic — supporting other agent CLIs, models, or providers.

## User Story

As a developer building multi-agent workflows, I want an orchestration tool that:
- Manages agent lifecycle (spawn, communicate, coordinate, terminate)
- Works with Claude Code today but isn't locked to it
- Supports multiple orchestration patterns (independent processes, nested orchestrators, in-session sub-agents)
- Uses MCP as the interface between orchestration and agent runtimes

## Architecture Layers

```
agent-team (orchestration)
  |- MCP interface (provider-agnostic boundary)
  |    |- claude provider (uses claude CLI + agent teams)
  |    |- future: other providers (ollama, openai-agents, etc.)
  |- agent lifecycle management
  |- inter-agent communication
  |- task coordination
```

## Immediate vs Future

### Now (claude-utils)
- `claude-team` → `claude-team-orchestrator` → `run-claude` (3-script split)
- `claude-team-worker` (future, same pattern)
- All tightly coupled to Claude Code CLI

### Later (agent-team project)
- MCP server as the abstraction layer between orchestration and runtime
- Orchestration logic extracted from claude-specific scripts
- Provider plugins implement spawn/communicate/terminate primitives

## Open Questions

### MCP as Interface Boundary
- Is MCP the right abstraction between "agent-team" (orchestration) and providers?
- Would agent-team expose MCP tools, or consume them, or both?
- What's the relationship between Claude Code's built-in team primitives (TeamCreate, SendMessage, etc.) and the MCP interface?

### Minimum Viable Agent Interface
- What operations must every provider support? Candidates:
  - `spawn(config) -> agent_id`
  - `send_message(agent_id, message) -> ack`
  - `get_status(agent_id) -> status`
  - `terminate(agent_id) -> result`
  - `list_agents() -> agent_id[]`
- Are tasks a provider concern or an orchestration concern?

### Process Model
- Does "independent process/container" mode imply a daemon/supervisor?
- Or is it still tied to a terminal session (just separate processes)?
- How does this interact with tmux -CC / iTerm2 integration?

### Teammate Launch Customizability
- Claude Code currently spawns teammates by invoking the binary directly
- Can the spawn command be customized or wrapped?
- If orchestration goes through `run-claude`, would teammates also go through it? (Likely no — they're spawned internally by Claude Code)
- This is a potential blocker for provider-agnostic teammate management

## Relationship to Other Specs

- `docs/specs/draft/agent-orchestration.md` — orchestration modes and 3-script architecture context
- `docs/specs/draft/3-script-architecture-plan.md` — immediate implementation plan
- `.claude/skills/agent-teams/SKILL.md` — current Claude Code agent teams reference

## References

- [Claude Code Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Agent Skills Standard](https://agentskills.io)
