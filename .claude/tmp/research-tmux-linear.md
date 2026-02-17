# Research: tmux Orchestration Layers & Linear Integrations for Agent Teams

**Date**: February 16, 2026  
**Research Scope**: Orchestration tooling for multi-agent AI systems, with focus on tmux layers and Linear project management integration  
**Status**: Comprehensive survey completed

---

## Executive Summary

The AI agent orchestration ecosystem has matured significantly in early 2026. Two major patterns have emerged:

1. **tmux as Orchestration Layer**: Multiple tools have standardized on tmux as the backbone for managing concurrent AI agent sessions, providing session persistence, pane management, and lifecycle coordination.

2. **Linear as Agent Context Sink**: Linear's official MCP server and Agent API create a native integration point where AI agents can read/write project data, creating tight feedback loops between task management and agent execution.

**Key Insight**: These patterns are complementary—tmux manages *session execution*, while Linear manages *task coordination*. Together they form a complete orchestration framework.

---

## Topic 1: tmux Orchestration Layers for Claude Code

### 1.1 Landscape Overview

tmux has emerged as the de facto standard for orchestrating multiple concurrent AI agents. The ecosystem includes:

- **Official Claude Code Agent Teams**: Native support in Claude Code for spawning teammate agents in tmux panes
- **Community orchestration tools**: 7+ specialized projects that wrap tmux to manage agent lifecycle
- **MCP servers**: tmux-mcp-server enables agents to interact with terminal sessions programmatically
- **Terminal multiplexer abstractions**: Tools that abstract tmux/zellij for broader terminal support

### 1.2 Architecture Patterns

#### Pattern A: Named Session Orchestration

**Tools implementing this**: Named Tmux Manager (NTM), Agent of Empires, Tmux Orchestrator

**Design**:
```
Session: "project_name"
├── Pane: project_name__cc_1 (Claude Code Agent 1)
├── Pane: project_name__cc_2 (Claude Code Agent 2)
├── Pane: project_name__cod_1 (Codex Agent 1)
├── Pane: project_name__gmi_1 (Gemini Agent 1)
└── Pane: project_name__user (User control pane)
```

**Benefits**:
- Persistent session state survives terminal disconnection
- Named panes enable programmatic targeting
- All agents visible simultaneously in tiled layout
- Single `attach` command to restore entire session

**Key Projects**:

- **Named Tmux Manager (NTM)** - Go CLI, command palette TUI
  - Repo: [github.com/Dicklesworthstone/ntm](https://github.com/Dicklesworthstone/ntm)
  - Spawn: `ntm spawn myproject --cc=4 --cod=2 --gmi=1`
  - Broadcast: `ntm send myproject --cc "please review this code"`
  - Token velocity badges show real-time tokens/second per agent
  - Supports safety guards to prevent dangerous commands

- **Agent of Empires** - Rust-based terminal session manager
  - Repo: [github.com/njbrake/agent-of-empires](https://github.com/njbrake/agent-of-empires)
  - Visual dashboard with status detection
  - Git worktree integration for branch isolation
  - Optional Docker sandboxing
  - Built-in git workflow coordination

#### Pattern B: Web Dashboard with Kanban Board

**Tools implementing this**: Agent Viewer, KanVibe

**Design**:
```
Web UI (Browser)
  ├── Kanban Board (Running/Idle/Completed columns)
  ├── Terminal Sessions (embedded/detached)
  └── Message Queue (SSE-driven updates)
    └── tmux Backend
        ├── Session 1
        ├── Session 2
        └── Session N
```

**Agent Viewer Implementation**:
- Spawns agents via `tmux new-session`
- Captures output via `tmux capture-pane`
- Sends messages via `tmux send-keys`
- Uses Claude Haiku for label generation (async, non-blocking)
- SSE for real-time board updates
- Two-file architecture: server.js + single-file HTML frontend

**KanVibe Features**:
- Repo: [github.com/rookedsysc/kanvibe](https://github.com/rookedsysc/kanvibe)
- Self-hosted Kanban board
- Browser terminals for direct agent interaction
- Hook-driven auto-tracking of tmux/zellij sessions
- Git worktree integration

#### Pattern C: VS Code as Control Plane

**Tool**: tmux-agents
- Repo: [github.com/super-agent-ai/tmux-agents](https://github.com/super-agent-ai/tmux-agents)

**Design**:
```
VS Code Sidebar
  ├── Tree View (Agent List)
  ├── Kanban Board View
  └── AI Chat Interface
    └── tmux Backend (each agent in own pane)
```

Turns VS Code into a unified control plane for managing agents running in tmux panes, with multiple viewing modes (tree, kanban, chat).

### 1.3 Agent Lifecycle Management Patterns

#### Lifecycle States

All tools implement similar state machines:

```
SPAWNED → IDLE → BUSY → COMPLETED
           ↑             ↓
           └─────────────┘ (message/prompt)
           
ERROR states: NEEDS_INPUT, STUCK, FAILED
```

#### Core Operations

**Spawning**:
- Define agent counts by type
- Tools auto-calculate pane layout
- Initial prompt injection on first keystroke

**Monitoring**:
- Parse terminal output for state detection (regex patterns)
- Token velocity metrics (tokens/second per agent)
- Idle detection via keystroke watchers

**Communication**:
- Broadcast mode: Send prompt to all agents of a type
- Targeted mode: Send to specific named pane
- Message queue for agents busy on other tasks

**Termination**:
- Soft kill: `Ctrl+C` via tmux send-keys
- Hard kill: `tmux kill-session`
- Cleanup: Auto-remove finished agent panes

### 1.4 Session Persistence and Resilience

**Problem solved**: SSH drops, terminal crashes don't lose agent state

**Solution pattern**:
```
Local machine → SSH → Remote tmux server
               (connection drops)
                      ↓
               Sessions persist on remote
               ↓
Reconnect with `tmux attach-session -t project_name`
```

All orchestration tools leverage tmux's server-side session model for resilience.

### 1.5 Integration Points with Claude Code

#### Official Support

- **Agent Teams Feature**: CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
- **Teammate Modes**: 
  - `--teammate-mode tmux` (native tmux panes)
  - `--teammate-mode iterm2` (iTerm2 tabs/windows)
  - in-process (fallback, limited visibility)

#### Third-Party Integration Patterns

Many tools auto-detect Claude Code in running panes by:
1. Parsing tmux pane titles/names
2. Matching terminal output patterns
3. Using heuristics on command history

### 1.6 MCP Server for tmux Orchestration

**tmux-mcp-server**
- Repo: [github.com/lox/tmux-mcp-server](https://github.com/lox/tmux-mcp-server)
- Enables AI agents to orchestrate other agents via tmux
- Agents can spawn sessions, send commands, capture output
- Opens programmatic agent self-orchestration

### 1.7 Emerging Orchestration Platforms

**Warp: The Agentic Development Environment**
- Site: [warp.dev](https://www.warp.dev/)
- Evolved from terminal into full agent development environment
- **Oz Platform**: Cloud orchestration for multi-agent coordination
- Features:
  - Multi-threaded agent execution and management
  - Internal task list per agent
  - User interception flows (agent pauses when interrupted)
  - Multi-repo changes capability
  - Full terminal use + computer use

---

## Topic 2: Linear Hooks/Integrations for Agent Teams

### 2.1 Linear's Agent Ecosystem

Linear has explicitly built for AI agents in 2026. Key infrastructure:

#### 2.1.1 Official Linear Agent API

**Documentation**: [linear.app/docs/agents-in-linear](https://linear.app/docs/agents-in-linear)

**Agent Capabilities**:
- Create as "app users" (behave like workspace users)
- Can be @-mentioned in comments
- Issue assignment triggers delegation (agent acts, human remains responsible)
- Create and reply to comments
- Collaborate on projects and documents
- Workspace-level or team-level guidance directives
- **Limitations**: Cannot sign in, no admin functionality, cannot manage users

**Agent Management**:
- Install agents via Integrations Directory
- Configure team-level guidance (overrides workspace guidance)
- Suspend agents via Settings > Administration > Members
- Track agent actions in activity timeline

#### 2.1.2 Official MCP Server for Linear

**Documentation**: [linear.app/docs/mcp](https://linear.app/docs/mcp)  
**GitHub Integration**: [mcp.composio.dev/linear](https://mcp.composio.dev/linear)

**Capabilities** (32+ tools):
- Find, create, update issues
- Manage projects
- Add/edit comments
- Manage attachments
- Retrieve project data
- Cycle management
- Label management

**Authentication**:
- OAuth 2.1 with dynamic client registration
- Or direct API key via Authorization headers
- Centrally hosted at `https://mcp.linear.app/mcp` (HTTP) and `https://mcp.linear.app/sse` (SSE)

**Supported Platforms**:
- Claude, Cursor, Codex, Jules, VS Code, v0 by Vercel, Windsurf, Zed
- 100+ other MCP-compatible clients

**Community Implementations**:
- [github.com/tacticlaunch/mcp-linear](https://github.com/tacticlaunch/mcp-linear) - Natural language issue interaction
- [github.com/touchlab/linear-mcp-integration](https://github.com/touchlab/linear-mcp-integration) - Alternative integration layer

### 2.2 Webhooks for Event-Driven Automation

**Documentation**: [linear.app/developers/webhooks](https://linear.app/developers/webhooks)

#### 2.2.1 Webhook Capabilities

**Event Types Supported**:
- Issues: created, updated, deleted
- Comments: created, updated
- Issue attachments
- Documents
- Emoji reactions
- Projects
- Project updates
- Cycles
- Labels
- Users
- Issue SLAs

**Webhook Delivery**:
- HTTP POST to registered URL
- Automatic retry on failure: 1 min, 1 hour, 6 hours
- Signature verification via webhook secret
- Real-time push (not polling)

#### 2.2.2 Creating Webhooks

**Via Web UI**: Settings > Integrations > Webhooks > New

**Via GraphQL API**:
```graphql
mutation {
  webhookCreate(
    input: {
      teamId: "team_abc123"
      url: "https://your-agent.com/webhook"
      resourceTypes: [Issue, Comment]
    }
  ) {
    webhook { id, url, resourceTypes }
  }
}
```

#### 2.2.3 Integration Platforms

Webhooks can connect to automation platforms:
- **n8n**: Create workflows combining Webhook + Linear
- **Zapier**: Webhook + Linear workflow templates
- **Pipedream**: HTTP endpoint + Linear integrations

**Use Case Pattern**:
```
Linear Issue Created (webhook)
  ↓
n8n Workflow
  ↓
Spawn Claude Code Agent for issue fix
  ↓
Agent pushes PR
  ↓
Linear MCP updates issue status
```

### 2.3 Cursor + Linear Integration

**Official Documentation**: [linear.app/integrations/cursor](https://linear.app/integrations/cursor)  
**Blog Post**: [How Cursor integrated with Linear for Agents](https://linear.app/now/how-cursor-integrated-with-linear-for-agents)

#### 2.3.1 Workflow

1. Assign Linear issue to Cursor
2. Cursor cloud agent (`cursor-agent`) executes the task
3. Agent creates PR automatically
4. Linear issue updated with status and PR link
5. Progress trackable in: Linear UI, Cursor web app, IDE

#### 2.3.2 Multiple Integration Modes

- **Direct Integration**: Assign issues, agent works autonomously
- **MCP Connection**: Cursor's inline agent can read/create issues without leaving IDE
- **Chat Interface**: Follow-up conversations within same session

#### 2.3.3 Key Innovation

This integration solves the "context fragmentation" problem: teams no longer need to context-switch between project management (Linear) and code execution (Cursor). The agent bridges both.

### 2.4 Why Linear Built for Agents

**Source**: [The New Stack - Why Linear Built an API For Agents](https://thenewstack.io/why-linear-built-an-api-for-agents/)

Linear's rationale:
1. **Context fragmentation is pain**: Developers context-switch between tools
2. **Agents need structured data**: Linear provides issue schema, status, assignees as agent input
3. **Feedback loops**: Agents need to close loops (read issue → execute → update issue)
4. **2026 predictions**: Gartner predicts 40% of enterprise apps will have task-specific agents by 2026 (vs <5% today)
5. **Standardization**: MCP server avoids vendor lock-in, works with any AI platform

---

## Topic 3: Integration Opportunities for Agent Teams

### 3.1 Architecture: Orchestration + Task Management

**Proposed Integration Layer**:

```
User Intent (Command)
  ↓
Agent Teams (tmux orchestration layer)
  ├── Lead Agent (orchestrator)
  ├── Teammate 1 (specialist)
  ├── Teammate 2 (specialist)
  └── Teammate N (specialist)
    ↓
Linear (task coordination layer)
  ├── Webhooks (event triggers)
  ├── MCP Server (context reads)
  ├── Agent API (status updates)
  └── Comments (async communication)
```

### 3.2 Workflow Patterns

#### Pattern A: Issue-Driven Agent Spawning

```
1. Linear Issue Created (webhook)
2. Trigger n8n workflow
3. n8n calls claude-team orchestrator
4. Lead agent reads issue via Linear MCP
5. Lead agent spawns teammates in tmux
6. Teammates execute in parallel
7. Lead agent aggregates results
8. Linear MCP updates issue with PR/results
```

#### Pattern B: Agent Self-Coordination via Linear

```
Lead Agent (in tmux pane)
  ├── Reads Linear issues to discover work
  ├── Spawns teammates for each issue
  ├── Updates Linear via MCP (status/comments)
  └── Teammates communicate via Linear comments
```

#### Pattern C: User Interception with Linear Context

```
User sends message (interrupts agent flow)
  ↓
Agent pauses (like Warp's pattern)
  ↓
Agent reads updated Linear guidance
  ↓
Agent adjusts internal task list
  ↓
Agent resumes with new context
```

### 3.3 Data Flow Improvements for claude-utils

**Current**: Agent teams coordinate only within tmux/Claude context.

**Proposed Enhancement**:
1. `claude-team` (orchestrator) reads Linear issues at startup
2. Teammates reference issue context via Linear MCP
3. Teammates update issue status as they progress
4. Lead agent uses Linear webhooks for external event coordination

### 3.4 Feedback Loop Closure

**Problem**: Agent teams work in isolation; external systems don't know progress

**Solution Pattern**:
```
Linear (source of truth)
  ↓ Issue created
  ↓ Webhook fires
  ↓
tmux-orchestrator spawns agents
  ↓ Agents read issue via MCP
  ↓ Agents create PR
  ↓ Agents update issue via MCP
  ↓
Linear (updated)
  ↓ Cycle continues
```

---

## Catalog: Key Tools & Repositories

### tmux Orchestration

| Tool | Repo | Language | Status | Key Feature |
|------|------|----------|--------|-------------|
| Named Tmux Manager (NTM) | [Dicklesworthstone/ntm](https://github.com/Dicklesworthstone/ntm) | Go | Active | Command palette, token velocity badges |
| Agent of Empires | [njbrake/agent-of-empires](https://github.com/njbrake/agent-of-empires) | Rust | Active | Visual dashboard, git integration |
| Agent Viewer | [hallucinogen/agent-viewer](https://github.com/hallucinogen/agent-viewer) | JavaScript/Node | Active | Web Kanban board, SSE updates |
| Tmux Orchestrator | [Jedward23/Tmux-Orchestrator](https://github.com/Jedward23/Tmux-Orchestrator) | Python | Active | Autonomous scheduling |
| KanVibe | [rookedsysc/kanvibe](https://github.com/rookedsysc/kanvibe) | Rust | Active | Browser terminals, hook-driven tracking |
| tmux-agents | [super-agent-ai/tmux-agents](https://github.com/super-agent-ai/tmux-agents) | TypeScript | Active | VS Code control plane |
| Agent Manager Skill | [fractalmind-ai/agent-manager-skill](https://github.com/fractalmind-ai/agent-manager-skill) | Python | Active | cron-friendly, no server |
| tmux-mcp-server | [lox/tmux-mcp-server](https://github.com/lox/tmux-mcp-server) | - | Active | MCP for tmux |
| Agent Deck | [asheshgoplani/agent-deck](https://github.com/asheshgoplani/agent-deck) | - | Active | Multi-agent terminal manager |
| CLI Agent Orchestrator | [awslabs/cli-agent-orchestrator](https://github.com/awslabs/cli-agent-orchestrator) | Python | Active | Hierarchical supervision model |

### Linear Integration

| Component | Link | Type |
|-----------|------|------|
| Linear Agent API | [linear.app/docs/agents-in-linear](https://linear.app/docs/agents-in-linear) | Official |
| Linear MCP Server | [linear.app/docs/mcp](https://linear.app/docs/mcp) | Official |
| Linear Webhooks | [linear.app/developers/webhooks](https://linear.app/developers/webhooks) | Official |
| mcp-linear (TacticLaunch) | [tacticlaunch/mcp-linear](https://github.com/tacticlaunch/mcp-linear) | Community |
| linear-mcp-integration (Touchlab) | [touchlab/linear-mcp-integration](https://github.com/touchlab/linear-mcp-integration) | Community |
| Cursor Integration | [linear.app/integrations/cursor](https://linear.app/integrations/cursor) | Official |

### Platforms

| Platform | Purpose |
|----------|---------|
| Warp (Oz Platform) | [warp.dev](https://www.warp.dev/) - Cloud orchestration for agent swarms |
| Composio | [mcp.composio.dev/linear](https://mcp.composio.dev/linear) - MCP integration hub |

---

## Key References & Sources

### Blog Posts & Articles

- [Addy Osmani - Claude Code Swarms](https://addyosmani.com/blog/claude-code-agent-teams/)
- [Dára Sobaloju (Medium) - How to Set Up Claude Code Agent Teams](https://darasoba.medium.com/how-to-set-up-and-use-claude-code-agent-teams-and-actually-get-great-results-9a34f8648f6d)
- [Dariusz Parys - Claude Code Multi-Agent tmux Setup](https://www.dariuszparys.com/claude-code-multi-agent-tmux-setup/)
- [Javier Aguilar - Claude Code Agent Teams in tmux](https://www.javieraguilar.ai/en/blog/claude-code-agent-teams)
- [The New Stack - Why Linear Built an API For Agents](https://thenewstack.io/why-linear-built-an-api-for-agents/)
- [Builder.io - How to set up and use the Linear MCP server](https://www.builder.io/blog/linear-mcp-server)
- [The New Stack - How Warp Went From Terminal to Agentic Dev Environment](https://thenewstack.io/how-warp-went-from-terminal-to-agentic-development-environment/)
- [Scuti AI - Combining tmux and Claude for Automated AI Agent System](https://scuti.asia/combining-tmux-and-claude-to-build-an-automated-ai-agent-system-for-mac-linux/)

### Official Documentation

- [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
- [Linear Developer Docs](https://linear.app/developers/webhooks)
- [Linear MCP Server Docs](https://linear.app/docs/mcp)
- [Linear Agent API](https://linear.app/docs/agents-in-linear)

### GitHub Issues

- [Claude Code Issue #23615 - Agent teams should spawn in new tmux window](https://github.com/anthropics/claude-code/issues/23615)

### Emerging Trends

- [Zenn - AI Agent Era with tmux Intro](https://zenn.dev/i9wa4/articles/2026-02-08-tmux-intro-ai-agent-orchestration) (Japanese article on tmux for agent orchestration)
- [Kieran Klaassen (X) - If you haven't created a tmux agent orchestrator...](https://x.com/kieranklaassen/status/2007128073813336206)
- [TmuxAI - AI-Powered Terminal Assistant](https://tmuxai.dev/)

### Industry Insights

- [TIME - Warp: Agentic Development Environment - Best Invention of 2025](https://time.com/collections/best-inventions-2025/7318249/warp-agentic-development-environment/)

---

## Confidence Assessment

### High Confidence

- tmux is the de facto standard for agent session orchestration
- Linear's MCP server is production-ready with 32+ tools
- Cursor + Linear integration is live and functional
- Multiple community tools have proven the patterns work

### Medium Confidence

- Long-term stability of community orchestration tools (may consolidate)
- Whether MCP becomes standard for agent-to-tool communication (likely but not certain)
- Timeline for feature parity across agent orchestrators

### Areas Needing Further Research

- Deep dive into tmux-mcp-server capabilities (limited documentation found)
- CLI Agent Orchestrator's actual performance at scale
- Custom agent development on Linear platform (limited public examples)
- Integration patterns for Warp/Oz with Linear

---

## Key Takeaways

1. **tmux Maturity**: The ecosystem is mature enough for production use in 2026. Multiple implementations validate the patterns.

2. **Linear as Agent Context**: Linear moved from "project management tool" to "agent coordination platform." MCP server + Webhook + Agent API form complete stack.

3. **Composability**: These tools are designed to compose. tmux handles execution, Linear handles coordination.

4. **No Vendor Lock-in**: MCP standardization + webhook compatibility mean teams can mix and match tools.

5. **User Experience Priority**: Latest generation (Agent Viewer, KanVibe, Warp) prioritize UX, not just functionality.

6. **2026 Inflection Point**: This year marks the shift from "agents as experiment" to "agents as infrastructure." Tooling reflects this maturity.

