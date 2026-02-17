# Bobbonauts Mission Brief: Claude Code Internals Deep Dive

## Objective

Reverse-engineer Claude Code's internals to understand its tool schemas, command definitions, agent spawning mechanisms (especially tmux-based), and team orchestration primitives — with enough fidelity to build an **MCP server** that exposes agent team orchestration capabilities externally. All findings feed into the **agent-teams skill** at `.claude/skills/agent-teams/`.

## Research Tracks (Parallelizable)

### Track 1: Binary Extraction & Source Recovery
- Claude Code is distributed as a **Node.js SEA (Single Executable Application)** — all source is bundled/compressed into one file
- Extract and decompress the source from the binary
- Recover readable JavaScript/TypeScript source
- Catalog the module structure and key entry points
- **Key tools**: `cchistory` (for extracting specific versions), Node.js SEA extraction techniques, `node --inspect`, source map recovery

### Track 2: Tool & Command Schema Discovery
- Extract all **tool definitions** (name, parameters, JSON schemas) available to Claude from both:
  - The CLI interface (user-facing commands like `/help`, `/commit`, etc.)
  - The agent interface (tools available to spawned sub-agents: Read, Write, Edit, Bash, Task, SendMessage, etc.)
- Document the complete tool catalog with parameter schemas
- Identify differences between CLI tools and agent tools
- Look for hidden/undocumented tools or capabilities

### Track 3: Agent Spawning & tmux Integration
- Trace the code paths for how Claude Code spawns teammate agents
- Document the **tmux session management** logic:
  - How sessions are created, named, and managed
  - How agents communicate through tmux
  - The `teammate_mode` configuration (`tmux` vs `in-process`)
- Understand the `Task` tool's implementation for launching sub-agents
- Document the agent lifecycle: spawn → work → idle → message → shutdown

### Track 4: Team Orchestration Primitives
- Map out the full **team orchestration system**:
  - `TeamCreate`, `TeamDelete`, `SendMessage`, `TaskCreate/Update/List/Get`
  - Team config files (`~/.claude/teams/`)
  - Task list files (`~/.claude/tasks/`)
- Document the message passing protocol between agents
- Understand how the team lead coordinates with teammates
- Identify the APIs/interfaces needed to replicate this externally

### Track 5: Web Research & Documentation
- Research Claude Code's public documentation for agent teams
- Search for blog posts, GitHub issues, changelogs about team features
- Look for community findings about Claude Code internals
- Cross-reference extracted code with public documentation
- Check https://code.claude.com/docs/ and GitHub repos

## Key Artifacts to Produce

### Research Notes (committed to repo)
| File | Content |
|------|---------|
| `docs/research/claude-code-binary-structure.md` | Binary format, extraction methods, module map |
| `docs/research/claude-code-tool-schemas.md` | Complete tool catalog with JSON schemas |
| `docs/research/claude-code-agent-spawning.md` | Agent lifecycle, tmux integration details |
| `docs/research/claude-code-team-orchestration.md` | Team primitives, message protocol, file formats |
| `docs/research/claude-code-web-findings.md` | Public docs, blog posts, community findings |

### Skill Supplements (for agent-teams skill)
| File | Content |
|------|---------|
| `.claude/skills/agent-teams/references/tool-schemas.md` | Extracted tool schemas relevant to agent teams |
| `.claude/skills/agent-teams/references/tmux-integration.md` | Detailed tmux session management reference |
| `.claude/skills/agent-teams/references/team-orchestration-internals.md` | Internal orchestration protocol details |
| `.claude/skills/agent-teams/references/mcp-server-design.md` | Design notes for the target MCP server |

## Working Conventions

- **Branch**: All work on a single shared branch (create from `main`)
- **Commits**: Commit early and often — as soon as a research file has meaningful content, commit it
- **Notes**: Save to files immediately, don't rely on conversation context
- **Format**: Markdown with code blocks for extracted source, JSON for schemas
- **File naming**: Lowercase kebab-case, descriptive names
- **No cleanup**: Raw notes are fine — polish into supplemental docs as a separate step

## Suggested Team Composition

| Role | Agent Type | Responsibility |
|------|-----------|---------------|
| **binary-analyst** | general-purpose | Track 1: Binary extraction, source recovery, module mapping |
| **tool-researcher** | general-purpose | Track 2: Tool/command schema extraction and documentation |
| **agent-tracer** | general-purpose | Track 3 & 4: Agent spawning, tmux, team orchestration code paths |
| **web-researcher** | research-lead | Track 5: Web research, public docs, community findings |
| **doc-writer** | general-purpose | Synthesize raw notes into polished skill supplements |

## Success Criteria

We're done when we have:
1. A complete catalog of Claude Code's tools with schemas
2. Deep understanding of how tmux-based agent spawning works
3. Documented team orchestration protocol (messages, files, lifecycle)
4. Enough implementation detail to design an MCP server that replicates team orchestration
5. All findings committed to the repo and integrated into the agent-teams skill

## Priority Order

1. Tool schemas (most directly useful for MCP server)
2. Agent spawning / tmux logic (core of what we need to replicate)
3. Team orchestration primitives (coordination protocol)
4. Binary structure (supporting research)
5. Web research (supplementary context)
