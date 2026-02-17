# Research Report: Google Gemini Code as an Agent Platform

**Date**: February 16, 2026  
**Status**: Comprehensive Research  
**Focus**: Gemini Code ecosystem (Gemini CLI, Gemini Code Assist, Jules) as agent platforms

---

## 1. Product Overview: What Is It and Maturity Level

### Three Distinct Products

Google's coding agent ecosystem consists of three separate but related products:

#### 1.1 Gemini CLI
- **What it is**: An open-source AI agent in your terminal. Brings Gemini directly to the CLI for development workflows.
- **Who made it**: Google (google-gemini organization on GitHub)
- **Maturity**: Production-ready with active development
- **Availability**: 
  - Free tier: 60 model requests/minute, 1,000 requests/day at no charge
  - Available without setup in Google Cloud Shell
  - Open-source on GitHub: [google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli)
- **Key capability**: Runs a ReAct (Reason-Act) loop in the terminal with file operations, shell commands, web access, and MCP servers
- **Models**: Uses Gemini 2.5 Pro with 1,000,000 token context window for large codebases

#### 1.2 Gemini Code Assist
- **What it is**: An IDE-native AI coding assistant for VS Code and IntelliJ. Google's answer to Claude Code.
- **Who made it**: Google
- **Maturity**: 
  - Agent mode: Preview in VS Code, Stable in IntelliJ (as of 2025)
  - Generally Available (GA)
- **Availability**: 
  - Free tier for individuals
  - Standard and Enterprise editions
  - Deprecated Tool Calling API (October 14, 2025); must migrate to MCP by March 2026
- **Key capability**: IDE-integrated agentic assistant with plan approval, inline diffs, chat, multi-file edits
- **Models**: Gemini 2.5 Pro and Gemini 2.5 Flash across all user tiers

#### 1.3 Jules
- **What it is**: An autonomous, asynchronous coding agent. Clones your repo into a secure Google Cloud VM and works independently.
- **Who made it**: Google (Google Labs)
- **Maturity**: 
  - Out of public beta as of 2025
  - Now available for everyone
- **Availability**: 
  - Jules app at [jules.google](https://jules.google)
  - Jules Tools: Lightweight CLI for task management
  - Jules API: Early preview for direct integration
  - Jules extension for Gemini CLI available
- **Key capability**: Offline, VM-based task execution (bug fixes, test writing, refactoring, version bumps)
- **Models**: Gemini 3 Pro (latest version as of early 2026)
- **Pricing**: 
  - Jules: 15 daily tasks, 3 concurrent
  - Jules Pro: 100 daily tasks, 15 concurrent
  - Jules Ultra: 300 daily tasks, 60 concurrent

### Quick Distinctions

| Product | Mode | Context | Launch | Best For |
|---------|------|---------|--------|----------|
| **Gemini CLI** | Sync/Interactive | Terminal/LocalMCP | `/gemini` command | Developer workflows, scripting, exploration |
| **Gemini Code Assist** | Sync/Interactive | IDE (VS Code, IntelliJ) | IDE chat | In-IDE coding, multi-file refactoring |
| **Jules** | Async/Autonomous | Secure Google Cloud VM | GitHub/Web UI | Background task automation, batch operations |

---

## 2. Architecture and Design Patterns

### 2.1 Gemini CLI Architecture

**Core Loop: ReAct Pattern**

Gemini CLI implements a classic ReAct (Reason-and-Act) loop:

```
Observation → Thought → Action → Observation → ...
```

This loop is explicitly interleaved in the conversation history to maintain reasoning coherence across steps.

**Functional Architecture**:
1. **Authentication Layer**: OAuth with Google, API keys, Vertex AI integration
2. **Tool System**: 
   - Built-in: file I/O, shell execution, web fetch, grep/search
   - Extensible via MCP (Model Context Protocol) servers
3. **Conversation Engine**: Stateful with checkpointing and token caching
4. **Context System**: GEMINI.md file mechanism for persistent project guidance

**Key Design Principles**:
- UI-less but powerful (terminal native)
- Modular architecture with `/packages` structure
- Extensible through MCP rather than monolithic
- Support for interactive and headless modes

**Tools Available**:
- Codebase Investigator Agent (file exploration)
- Edit (replace), FindFiles (glob), GoogleSearch
- ReadFile, ReadFolder, SaveMemory, SearchText
- Shell (run_shell_command), WebFetch, WriteFile, WriteTodos

### 2.2 Gemini Code Assist Agent Mode Architecture

**Two-Pane Interactive Model** (VS Code & IntelliJ):
1. **Chat Pane**: Natural language development and refinement
2. **Agent Workspace**: Displays generated plans, diffs, approvals

**Execution Flow**:
1. User sends prompt → Gemini API with available tools
2. API determines: answer directly OR request tool use
3. For file-modifying actions: explicit permission required
4. Tool results feed back to API (cycle continues until done)
5. For complex projects: High-level plan presented for approval

**Context Sources by IDE**:
- **VS Code**: Workspace files, Google Search integration
- **IntelliJ**: Project symbols, version control, indexed code references

**Integration Layer**: MCP servers for external tool connectivity (replaces deprecated Tool Calling API)

### 2.3 Jules Architecture

**Async Execution Model**:
1. **Clone**: Jules clones your repo into a secure Google Cloud VM
2. **Analyze**: Gemini 3 Pro analyzes full codebase context
3. **Plan**: Agent develops implementation strategy
4. **Generate**: Creates code diff for review
5. **PR Ready**: Upon approval, creates pull request

**Isolation**: 
- Runs in secure, isolated Google Cloud environment
- No training on private code
- Data stays isolated within execution environment

**Extension Integration** (via Gemini CLI):
- `/julius` command to delegate tasks asynchronously
- Run tasks in background while staying in Gemini CLI flow
- Query task status without blocking

---

## 3. Agent Communication Model: Multi-Agent and Orchestration Support

### 3.1 Gemini CLI Multi-Agent Capabilities

**Current Status**: Experimental sub-agents feature (in development)

**Sub-Agent Architecture**:
- Specialized agents for specific tasks (code review, documentation, deep analysis)
- Each has its own system prompt, persona, and restricted tool set
- Operate within main session context without cluttering main agent tools
- Supports task delegation and independent contexts

**Parallel Execution Status**:
- **Limitation**: Tool calls execute sequentially by default
- **Workaround**: Maestro (community project) uses shell-based parallel dispatch
- **Roadmap**: Native parallel subagent execution planned

**Community Orchestration Implementations**:
1. **Maestro-Gemini**: 12 specialized subagents with TechLead orchestrator
   - 4-phase workflow: Design → Plan → Execute → Complete
   - Parallel dispatch via scripts/parallel-dispatch.sh
   - Standalone dev tools (code review, debugging, security, performance)

2. **Prompt-Based Orchestration**: Multi-agent via composition
   - Task queue management
   - Shared long-term context areas
   - Logging and scratchpad files

3. **Strategist-Specialist Model**: Dynamic routing
   - Strategist agent spins off specialists on demand
   - Specialist returns control to strategist for checks

### 3.2 Gemini Code Assist Multi-File Editing

**Current Model**: Single synchronous agent with multi-file awareness
- Analyzes entire codebase for context
- Presents multi-step plans before execution
- User approves plan → agent executes changes
- Sequential, not parallel

**Notable Limitation**: Unlike Claude Code, does not spawn parallel subagents (e.g., one writing tests, another writing implementation)

### 3.3 Gemini Enterprise: Agent Designer & ADK

**Gemini Enterprise Agent Designer** (no-code/low-code platform):
- Visual workflow editor with Flow, Schedule, and Preview tabs
- Single and multi-step agents
- Main agent + subagents for complex orchestration
- Data source integration (Gmail, Google Drive, Jira)
- Scheduled execution
- Central governance and audit

**Agent Development Kit (ADK)** (code-first framework):
- Open-source framework (Python and TypeScript)
- Makes agent development feel like "standard software development"
- Workflow agents: Sequential, Parallel, Loop patterns
- LLM-driven dynamic routing for adaptive behavior
- Modular composition of specialized agents
- Pre-built tools (Search, Code Exec), MCP tool support, 3rd-party lib integration
- Multi-language: Python and TypeScript/JavaScript

**Key Innovation**: ADK for multi-agent systems emphasizes composition over monolithic design

---

## 4. Task Management Approach

### 4.1 Gemini CLI

**Implicit Task Management**:
- ReAct loop maintains implicit task state in conversation history
- `/memory` command for saving long-term context
- `/stats` command for usage and token metrics
- GEMINI.md for persistent project-level task guidance

**Hooks for Workflow Customization**:
- Event-driven extensions without modifying core code
- Tailor behavior to specific workflows

### 4.2 Gemini Code Assist

**Plan-Based Approach**:
1. User describes task → Agent generates high-level plan
2. User reviews and approves plan
3. Agent executes with full user control
4. Checkpointing: Save/rollback progress as needed (unique vs. Claude Code)

**Task Visibility**:
- Inline diffs in IDE
- Plan approval workflow
- Tool permission management

### 4.3 Jules

**Explicit Task Management**:
- `/jules-tools` CLI for task lifecycle
- Task queue with status tracking
- Async execution with background polling
- PR-ready output after completion

---

## 5. Unique Features: What Gemini Offers That Claude Code Doesn't

### 5.1 Thought Signatures (Gemini 3+)

**Problem Solved**: "Reasoning Drift" in multi-step agent tasks
- Agents lose reasoning context after each tool call
- Forget why they asked for information when results return

**Solution**: Encrypted "Thought Signatures"
- Preserve model's internal reasoning state
- Pass signatures back in conversation history
- Maintain exact train of thought across steps
- Ensures reliable multi-step execution

**Implementation**: Built into Gemini 3 Pro (not available in Claude Code)

### 5.2 Massive Context Window (1M Tokens)

- Entire large codebases fit in single inference pass
- File trees and documentation held simultaneously
- Superior for large-scale refactoring

**Claude Code**: Also 1M tokens (Sonnet 4.5) — feature parity

### 5.3 Built-in Google Integration

- Native Google Search tool (not available in Claude)
- Vertex AI integration
- Cloud Logging, Cloud Storage native support
- Maps API toolkit and other Google services

### 5.4 Async Task Execution (Jules)

- VM-based autonomous agent independent of main session
- Works in background while developer focuses on current task
- No direct equivalent in Claude Code (which runs synchronously)

### 5.5 Checkpointing and Rollback

- Gemini Code Assist: Save progress and roll back safely
- Better error recovery for aggressive refactoring
- Not standard in Claude Code

### 5.6 MCP as Core Abstraction

- Gemini migrating entirely to MCP (replacing Tool Calling API)
- Standardized provider-agnostic tool integration
- Ecosystem plays role in positioning for multi-provider future

---

## 6. Gemini vs Claude Code: Native Agent Teams

### 6.1 Claude Code Architecture (For Comparison)

**Native Subagent Capability**:
- Claude Code **can spawn specialized parallel subagents**
- Example: One agent writes tests, another writes implementation, third updates docs
- Results merge automatically
- Works synchronously within same session

**Advantages**:
- True parallelization for independent subtasks
- Built-in multi-file coordination
- Handles large-scale changes with less supervision

### 6.2 Gemini Code Assist vs Claude Code

| Aspect | Claude Code | Gemini Code Assist |
|--------|-------------|-------------------|
| **Native Subagents** | Yes, parallel execution | No (sub-agents experimental only) |
| **Execution Model** | Autonomous, parallel | Sequential, user-guided approval |
| **Checkpointing** | Not standard | Yes, save/rollback progress |
| **Multi-File Refactoring** | Handles independently | Requires prompt-by-prompt guidance |
| **Supervision Level** | Less (competent junior dev) | More (requires ongoing approval) |
| **Recovery Options** | Limited | Better error recovery |

### 6.3 Gemini Enterprise Multi-Agent vs Claude Code Teams

**Gemini Enterprise (ADK + Agent Designer)**:
- Explicitly designed for multi-agent orchestration at enterprise scale
- Agents as composable building blocks
- Central governance framework
- No equivalent in Claude Code (which focuses on IDE-native agents)

**Claude Code Teams** (Experimental):
- Uses tmux for session isolation
- Delegates specialized tasks to teammate agents
- Hooks for session lifecycle management
- More lightweight than Gemini Enterprise but less feature-rich

---

## 7. Lessons for Provider-Agnostic Agent Orchestration

### 7.1 MCP as the Standardization Layer

**Key Learning**: Model Context Protocol solves the fragmentation problem

- **Model-Agnostic**: Can swap OpenAI, Anthropic, Google, or other providers
- **Tool-Agnostic**: Standardized tool interface separates implementation from agent logic
- **JSON-RPC Foundation**: Predictable message format for all interactions
- **Discovery Protocol**: tools/list call to discover capabilities before use

**For Claude-Utils Orchestration**:
- MCP servers could be primary extension point
- Both Gemini CLI and Claude Code integrate MCP
- Future agents (Gemini 3, Claude 4, other providers) likely adopt MCP
- Provider-agnostic orchestration built on MCP == longevity

### 7.2 Thought Signatures / Reasoning Preservation

**Key Learning**: Stateless APIs lose reasoning context in multi-step tasks

- Explicit state preservation needed for reliable agent chains
- Gemini's Thought Signatures approach: encrypt and pass back reasoning
- Claude Code: May need equivalent for long multi-step chains

**For Orchestration**:
- Multi-agent workflows need reasoning state passed between agents
- Provider abstraction must preserve reasoning context
- Consider storing conversation turns with encrypted state for resumption

### 7.3 Async + Sync Execution Modes

**Key Learning**: Different workflows need different execution models

- **Sync (Gemini CLI, Claude Code)**: Interactive development, immediate feedback
- **Async (Jules)**: Background automation, batch operations, parallel tasks
- **Hybrid (Gemini CLI + Jules extension)**: Developer stays focused while Jules works

**For Orchestration**:
- Agent platform should support both modes
- Async agents could work in parallel while sync agents provide oversight
- Session models matter: isolated vs. shared context

### 7.4 Composable Agent Primitives

**Key Learning**: Multi-agent orchestration = composition of specialized agents

Successful patterns:
- Agent Designer: Visual composition with flow logic
- ADK: Workflow primitives (Sequential, Parallel, Loop)
- Maestro: Role-based agents with specialization

**For Orchestration**:
- Avoid monolithic "orchestrator" pattern
- Prefer composable agent roles (Coordinator, Specialist, Reviewer)
- Each agent has narrow responsibility and constrained tool set
- Orchestrator logic = composition + routing, not centralized control

### 7.5 Context Management at Scale

**Key Learning**: Massive context windows (1M tokens) enable new patterns

- Entire large codebases in single inference pass
- File trees + documentation + full conversation history
- Eliminates need for aggressive summarization

**For Orchestration**:
- Large context windows reduce need for complex memory management
- However, parallel agents still can't share live context
- Checkpoint/resume patterns more important than memory optimization

### 7.6 Checkpointing and Recovery

**Key Learning**: Enterprise agents need explicit error recovery

- Gemini Code Assist: Save/rollback progress
- Jules: PR for human review before merge
- Claude Code: Less emphasis on rollback (relies on git)

**For Orchestration**:
- Multi-agent workflows need explicit checkpointing
- Each agent produces reviewable artifact (diff, plan, code)
- Human approval gates between phases reduce risk

### 7.7 Hooks and Event-Driven Customization

**Key Learning**: Workflows vary; extensibility via hooks over configuration

Gemini CLI approach:
- Event hooks (SessionStart, Stop, etc.)
- Custom behavior without modifying core code
- Declarative configuration in settings.json

**For Orchestration**:
- Hooks for agent lifecycle events
- Plugins for workflow customization
- Settings-based configuration over hardcoded behavior

---

## 8. Links and Sources

### Official Google Documentation
- [Gemini Code Assist Release Notes](https://developers.google.com/gemini-code-assist/resources/release-notes)
- [Agent Mode Overview](https://developers.google.com/gemini-code-assist/docs/agent-mode)
- [Gemini CLI Documentation](https://developers.google.com/gemini-code-assist/docs/gemini-cli)
- [Gemini CLI GitHub Repository](https://github.com/google-gemini/gemini-cli)
- [Gemini Code Assist: June/July 2025 Updates](https://blog.google/technology/developers/gemini-code-assist-updates-july-2025/)
- [Agent Designer - Gemini Enterprise](https://docs.cloud.google.com/gemini/enterprise/docs/agent-designer)
- [Agent Development Kit Documentation](https://google.github.io/adk-docs/)
- [Thought Signatures - Gemini API](https://ai.google.dev/gemini-api/docs/thought-signatures)

### Jules
- [Jules Official Site](https://jules.google)
- [Jules: Google's Autonomous AI Coding Agent](https://blog.google/technology/google-labs/jules/)
- [Jules Now Available (Public Beta Exit)](https://blog.google/technology/google-labs/jules-now-available/)
- [Jules Tools Announcement](https://developers.googleblog.com/en/meet-jules-tools-a-command-line-companion-for-googles-async-coding-agent/)
- [Jules GitHub](https://github.com/gemini-cli-extensions/jules)
- [Master Multi-Tasking with Jules Extension](https://cloud.google.com/blog/topics/developers-practitioners/master-multi-tasking-with-the-jules-extension-for-gemini-cli)

### Model Context Protocol
- [Model Context Protocol Official](https://modelcontextprotocol.io/)
- [IBM: What is MCP?](https://www.ibm.com/think/topics/model-context-protocol)
- [Dremio: MCP Beginner's Guide](https://www.dremio.com/blog/the-model-context-protocol-mcp-a-beginners-guide-to-plug-and-play-agents/)
- [MCP for Agent Orchestration - IBM](https://developer.ibm.com/articles/mcp-architecture-patterns-ai-systems/)

### Multi-Agent Orchestration & Extensions
- [Maestro Gemini: Multi-Agent Platform](https://github.com/josstei/maestro-gemini)
- [Gemini CLI Multi-Agent Discussion](https://github.com/google-gemini/gemini-cli/discussions/7637)
- [How to Turn Gemini CLI into Multi-Agent System](https://aipositive.substack.com/p/how-i-turned-gemini-cli-into-a-multi-agent-system-with-just-prompts)
- [Advanced Gemini CLI: Part 3 - Dynamic Isolated Agents](https://medium.com/google-cloud/advanced-gemini-cli-part-3-isolated-agents-b9dbab70eeff)
- [From Coder to Conductor: Orchestrating Agents with Gemini & Jules](https://medium.com/israeli-tech-radar/from-coder-to-conductor-orchestrating-agents-with-gemini-jules-2a2fd11589a7)

### Comparisons
- [Gemini vs Claude Code 2026 Review](https://www.educative.io/blog/claude-code-vs-gemini-code-assist)
- [Claude Code vs Gemini CLI Comparison](https://shipyard.build/blog/claude-code-vs-gemini-cli-who-is-winning-in-january-2026/)
- [Gemini Code Assist: Complete 2025 Guide](https://www.digitalapplied.com/blog/google-gemini-code-assist-agent-mode-guide)

### Research & Deep Dives
- [Building AI Agents with Gemini 3](https://developers.googleblog.com/building-ai-agents-with-google-gemini-3-and-open-source-frameworks/)
- [ReAct Agents with Gemini - Hands-On Guide](https://medium.com/google-cloud/building-react-agents-from-scratch-a-hands-on-guide-using-gemini-ffe4621d90ae)
- [ReAct Agent with Gemini and LangGraph](https://ai.google.dev/gemini-api/docs/langgraph-example)
- [Building Multi-Agent Systems with ADK](https://medium.com/google-cloud/building-a-multi-agent-assistant-with-gemini-and-the-agent-development-kit-cc448d0cfa1b)
- [Gemini CLI with MCP - Google Codelab](https://codelabs.developers.google.com/cloud-gemini-cli-mcp-go)

---

## 9. Key Takeaways for Claude-Utils Architecture

1. **MCP is the Future**: Provider-agnostic orchestration built on MCP ensures longevity and interoperability with Gemini CLI, Claude Code, and future platforms.

2. **Reasoning Preservation**: Multi-step agent chains need explicit reasoning state management (like Thought Signatures). This is especially important for coordinator + specialist patterns.

3. **Execution Modes Matter**: Support both sync (interactive) and async (background) execution. Hybrid workflows (Gemini CLI + Jules) show clear value.

4. **Composable Primitives**: Avoid monolithic orchestrators. Use role-based agents with narrow responsibilities and constrained tool sets. Orchestrator = composition engine.

5. **Checkpointing is Enterprise**: Multi-agent workflows should produce reviewable artifacts at each phase with human approval gates. Not just "make changes," but "here's the plan, approve it."

6. **Hooks for Extensibility**: Event-driven customization (SessionStart, Stop, etc.) allows workflows to be tailored without core code changes. Settings.json drives behavior.

7. **Context Windows Enable Simplification**: With 1M-token windows, entire codebases fit in single passes. This reduces memory complexity compared to older systems but doesn't solve parallel agent coordination.

8. **Async Agents for Parallel Work**: Jules pattern shows value of independent agents working in background. Orchestrator can delegate work and continue, improving developer flow and perceived parallelization.

---

**Report End**
