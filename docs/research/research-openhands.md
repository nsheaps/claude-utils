# OpenHands Research Report: Comprehensive Analysis of AI Agent Platform Architecture

**Date:** February 16, 2026  
**Scope:** OpenHands (formerly All Hands AI) - AI agent orchestration platform architecture, design patterns, and comparison to Claude Code agent teams

---

## 1. What It Is, Who Made It, Maturity Level

### Project Identity

**OpenHands** is an open-source, model-agnostic platform for AI software developers operating as generalist agents. The platform enables AI agents to interact with digital environments in similar ways to human developers: writing code, interacting with command lines, browsing the web, calling APIs, and executing arbitrary code.

**Creator:** All-Hands-AI organization (community-driven with academic and industry contributors)

**License:** MIT (core) + separate enterprise licensing  
**Home:** https://openhands.dev/  
**GitHub:** https://github.com/OpenHands/OpenHands

### Maturity Metrics

| Metric | Value | Assessment |
|--------|-------|------------|
| GitHub Stars | 67,900 | Significant adoption; among top open-source AI projects |
| Contributors | 469 | Large active community |
| Forks | 8,500 | High reusability interest |
| Total Commits | 6,037 | Sustained development |
| Latest Release | 1.3.0 (Feb 2, 2026) | Active maintenance |
| Total Releases | 98 | Regular release cadence |
| Conference Status | ICLR 2025 (published) | Peer-reviewed validation |
| Primary Languages | Python (75.5%), TypeScript (22.3%) | Production-quality codebase |

### Release Cadence

The project maintains an aggressive release schedule with 98 releases across versions 0.x through 1.3.0. Recent releases show monthly or more frequent updates, indicating active feature development and community responsiveness.

### Project Positioning

OpenHands explicitly positions itself as:
- **Open alternative to proprietary agents** (vs. Devin, Claude Code, Cursor)
- **Zero vendor lock-in** community platform
- **Model-agnostic** (supports Claude, GPT, and other LLMs)
- **Extensible research platform** for academic and commercial use

---

## 2. Architecture and Design Patterns

### Core Architecture Overview

OpenHands V1 refactored from a monolithic V0 into a **modular SDK with clear separation of concerns**. The architecture couples:
- Event-sourced state management
- Immutable component design
- Sandboxed execution
- Built-in REST/WebSocket server
- Workspace-level remote interfaces

### Four-Package Modular Design

The SDK is organized into distinct packages with clear boundaries:

```
openhands.sdk
├── Agent (reasoning-action orchestrator)
├── Conversation (state container)
├── LLM (language model interface)
└── Tool (action definitions)

openhands.tools
├── BashTool
├── PythonTool
├── EditorTool
├── BrowserTool
└── [Custom tools]

openhands.workspace
├── LocalWorkspace (direct filesystem/shell)
├── RemoteWorkspace (HTTP delegation)
└── DockerWorkspace (containerized)

openhands.agent_server
├── FastAPI server
├── REST endpoints
├── WebSocket streaming
└── Session management
```

**Design Principle:** "Strict separation of concerns" where the agent core is decoupled from applications, enabling deployment across SDK, CLI, GUI, and cloud infrastructures using the same underlying logic.

### Event-Sourced State Model

**ConversationState** is the only stateful component, implementing a single source of truth:

```python
# Conceptual structure
class ConversationState:
    - messages: List[Message]  # User and assistant messages
    - actions: List[Action]    # All executed actions
    - observations: List[Observation]  # Environmental feedback
    - metadata: Dict  # Session info, timestamps, etc.
```

Key properties:
- **Immutable history:** All events append-only, never rewritten
- **Deterministic replay:** Full session recovery from event log
- **Pause/resume capability:** Agent can be paused mid-task and resumed with identical context
- **Remote serialization:** State fully serializable for network transmission

### Runtime Environment: Docker Sandboxing

OpenHands provides **opt-in, configurable sandboxing** with Docker as the default:

```
Host System
    │
    ├─ OpenHands Application Container
    │   (FastAPI, orchestration, agent logic)
    │
    ├─ Runtime Container (isolated execution)
    │   ├─ Base Image (user-provided)
    │   ├─ OpenHands Runtime Client
    │   └─ Action Execution Server
    │
    └─ Workspace Storage (shared volume)
        (project files, state persistence)
```

**Execution Flow:**
1. Agent proposes action (e.g., `bash echo "test"`)
2. Action serialized to JSON
3. Sent to Runtime Container via gRPC/HTTP
4. Executed in isolated sandbox
5. Output captured and returned as Observation
6. Agent receives observation in next reasoning cycle

**Advantages over in-process execution:**
- Resource limits per agent
- Killed containers don't affect host
- Multi-agent parallel safety
- Clean environment between tasks
- Plugin system support

### Agent Implementation: CodeAct Pattern

The default **CodeAct** (Code Actions) agent operates through a unified coding control plane:

```
At each step:
1. Provide LLM with:
   - Full conversation history
   - Available tools (function specs)
   - Current context (repo structure, errors)
2. LLM responds with action or message
3. Parse response into:
   - AgentMessage (conversational response)
   - Action (tool call: bash/python/edit)
4. Execute action in workspace
5. Capture observation
6. Append to conversation history
7. Repeat (step 1-7 until task complete)
```

**Key insight:** CodeAct merges reasoning and action into one control plane. The LLM **generates executable code directly** rather than natural language descriptions of what to do. This reduces latency and ambiguity.

### Agent Step Function (Single-Step Execution Model)

Each `agent.step()` call processes **one reasoning-action cycle**:

```python
def step(self, state: ConversationState) -> ConversationState:
    # 1. Execute pending actions awaiting confirmation
    if pending_confirmations():
        return state_with_executed_actions()
    
    # 2. Optionally compress history if condenser exists
    if history_too_large():
        state = condenser.compress(state)
    
    # 3. Query LLM with current context
    llm_response = llm.query(
        messages=state.messages,
        tools=available_tools,
        system_prompt=system_prompt
    )
    
    # 4. Parse response into events (Message or Action)
    events = parse_response(llm_response)
    
    # 5. Validate and optionally confirm actions
    if requires_confirmation():
        request_user_approval(events)
        return state_awaiting_confirmation()
    
    # 6. Execute tools and generate observations
    for action in events:
        observation = execute_tool(action)
        events.append(observation)
    
    # 7. Update conversation state
    state.append_events(events)
    return state
```

**Design principle:** "Agent holds no mutable state between steps" — enables interruption, inspection, and resumption of agent execution.

---

## 3. Agent Communication Model

### Event Stream Architecture

All communication flows through a **type-safe event hierarchy**:

```
Event (abstract base)
├── Message
│   ├── UserMessage (human input)
│   └── AssistantMessage (agent response)
├── Action (agent intends to do something)
│   ├── BashAction(command: str)
│   ├── PythonAction(code: str)
│   ├── EditAction(file: str, before: str, after: str)
│   ├── BrowserAction(...)
│   └── AgentDelegateAction(task: str, delegate: str)
└── Observation (environmental feedback)
    ├── CommandObservation(exit_code: int, stdout: str)
    ├── FileObservation(content: str, path: str)
    ├── ErrorObservation(error: str)
    └── BrowserObservation(...)
```

### Action-Execution-Observation Triad

OpenHands implements a strict, type-validated flow:

```
1. ACTION (Pydantic-validated input schema)
   └─ BashAction with validated command string
   
2. EXECUTION (ToolExecutor enforces constraints)
   └─ Sandbox execution
   └─ Resource limits checked
   └─ Security policy applied
   
3. OBSERVATION (Structured, serializable output)
   └─ {"exit_code": 0, "stdout": "...", "stderr": "..."}
   └─ Returned to LLM for next reasoning step
```

**Key property:** All steps are deterministic and reversible. The full event sequence can be replayed to recover state.

### Multi-Agent Coordination: Sub-Agent Delegation

Agents coordinate through **AgentDelegateAction**, a first-class action type:

```python
class AgentDelegateAction(Action):
    """Delegate a subtask to a specialized sub-agent."""
    task: str                    # What to delegate
    agent_name: str              # Which agent (e.g., "BrowsingAgent")
    workspace: WorkspaceRef      # Shared workspace context
    model_config: LLMConfig      # Inherited from parent
    delegated_at: timestamp
```

**Execution model:**
```
Parent Agent (CodeAct)
    │
    ├─ Identifies task needs web browsing
    │
    ├─ Creates AgentDelegateAction
    │   └─ task: "Navigate to example.com and find pricing"
    │   └─ agent_name: "BrowsingAgent"
    │
    ├─ Sub-agent spawns as independent conversation
    │   ├─ Inherits parent's LLM config
    │   ├─ Shares workspace context (file system, env vars)
    │   ├─ Runs its own reasoning-action loop
    │   └─ Communicates with browser
    │
    └─ Parent waits for sub-agent completion
        └─ Receives observation with results
        └─ Continues parent's reasoning
```

**Properties:**
- **Blocking parallel execution** (current implementation)
- **Isolation:** Sub-agents have independent conversation history
- **Shared resources:** Both access same workspace/files
- **Extensibility:** Complex coordination implemented as user-defined tools (not core SDK changes required)

### Asynchronous Communication Layer

For distributed deployment, OpenHands uses **FastAPI + WebSocket**:

```
Frontend (Browser/IDE)
    ├─ REST API for settings, history retrieval
    └─ WebSocket for real-time streaming
        │
        ├─ → [User message, confirmations, pause/resume]
        │
        ├─ ← [Agent actions, observations, errors]
        │
        └─ Maintains connection for live updates

RemoteConversation (Client)
    └─ Serializes agent.step() call
    └─ Sends configuration + state over HTTP
    └─ Receives observation stream via WebSocket
    └─ Updates local state incrementally
```

**Communication protocol:**
- REST: `POST /conversations/{id}/step` → returns action
- WebSocket: `Tool execution started` → `Tool finished` → stream of observations
- Bidirectional: Frontend can send pause/resume, user feedback during execution

---

## 4. Task Management Approach

### Current Implementation: Event-Centric (Not Explicit Task Tracking)

OpenHands **does not have native task management** in the traditional sense (Asana, Jira style). Instead:

1. **Task is implicit in conversation history**
   - User's initial message = task definition
   - All subsequent messages/actions = task progress
   - Event stream = task execution trace

2. **Planning approach**
   - Agent can be prompted to create a `.md` file with checklist
   - User can manually track progress via file edits
   - No automatic task state machine

### Proposed Future: TASK Microagents

GitHub issue #7290 discusses implementing explicit `TASK` microagents:
```python
# Proposed (not yet implemented)
@agent
class TaskAgent:
    """Manages task decomposition and tracking."""
    def decompose(task: str) -> List[SubTask]
    def track_progress(task_id: str) -> TaskStatus
    def update(task_id: str, update: str) -> void
```

Status: **Under development, not production-ready**

### External Integration: GitHub Issues

OpenHands can integrate with GitHub issues (proposed in issue #6798):
- Fetch issues as tasks
- Update issues with agent progress
- Close issues when agent completes work

Status: **Proposed, not yet standard feature**

### Evaluation Harness: Task-like Behavior

For benchmarking, OpenHands uses evaluation harnesses:
```python
class EvaluationTask:
    - task_description: str
    - initial_state: str  # e.g., git repo state
    - success_criteria: str
    - user_response_fn: Callable  # Simulates user feedback
```

**Used for:**
- SWE-Bench (GitHub issue resolution)
- WebArena (web interaction tasks)
- Benchmarking agent capability

---

## 5. Unique Features

### A. Event-Sourced, Deterministic State Management

**Unique to OpenHands** relative to many agentic systems:
- Full event log enables deterministic replay
- Agent can be paused mid-step and resumed identically
- State is serializable and storable (not tied to process memory)
- Supports recovery from agent crashes without losing progress

**Example scenario:**
```
12:00:00 - Agent starts task
12:05:00 - After 5 steps, user pauses agent
12:06:00 - Deploy new agent version
12:06:05 - Resume from step 5 with exact state
         (new version inherits full context)
```

### B. Composable, Multi-Package SDK Architecture

Rather than monolithic framework, OpenHands splits:
- **openhands.sdk** — Core agent logic (reusable)
- **openhands.tools** — Concrete tool implementations (swappable)
- **openhands.workspace** — Execution backends (pluggable)
- **openhands.agent_server** — Deployment infrastructure

**Benefit:** Researchers can use SDK without server, or swap out tools without touching agent core.

### C. Model Context Protocol (MCP) Integration

**MCP native support** allows agents to discover and use external tools:

```python
# Configure MCP server
mcp_config = {
    "notion": {
        "url": "http://localhost:3001",
        "auth": "oauth"
    },
    "github": {
        "url": "http://localhost:3002",
        "auth": "token"
    }
}

agent = Agent(
    llm=...,
    tools=[...standard tools...],
    mcp_config=mcp_config  # Notion, GitHub tools auto-discovered
)
```

**Benefit:** Dynamic, external tool discovery without recompiling agent. Matches Anthropic's MCP ecosystem.

### D. Multi-Agent Support via Tool Abstraction

Sub-agent delegation implemented as **standard tool**, not special-cased:

```python
# Sub-agent delegation is just a Tool
class AgentDelegateTool(Tool):
    """Delegate subtask to another agent."""
    def execute(self, task: str, agent_name: str) -> Observation:
        sub_agent = agent_registry.get(agent_name)
        result = sub_agent.run(task)
        return Observation(result)
```

**Benefit:** Complex multi-agent patterns (fan-out, pipelines, etc.) can be implemented as user tools without core SDK modification. Extensibility is first-class.

### E. Production-Ready Deployment Infrastructure

**Built-in FastAPI server** with:
- REST API for stateless operations
- WebSocket for real-time streaming
- Session management
- Multi-user support
- Cloud-native (Kubernetes-ready)

**Benefit:** No custom infrastructure needed. Deploy agent as microservice immediately.

### F. Rigorous Evaluation Framework

**OpenHands Index** — Comprehensive benchmarking:
- 15+ task categories (not just code)
- SWE-Bench (GitHub issue resolution)
- WebArena (web interaction)
- Specialized benchmarks
- Reproducible evaluation harness

**Current performance (Feb 2026):**
- SWE-Bench Verified: 66.4% (with critic model selection)
- State-of-the-art on multiple benchmarks

---

## 6. Comparison to Claude Code Agent Teams

### Claude Code Native Agent Teams (Your Reference Model)

**Spawning:**
- Fire-and-forget subprocess launch
- Each agent runs independently
- Limited shared state

**Communication:**
- File-based inbox approach
- Leader-centric (orchestrator delegates)
- File system as message broker

**Backends:**
- tmux (terminal multiplexing)
- In-process (same Python interpreter)
- Direct stdio communication

**State Management:**
- Process-level mutable state
- Settings.json for configuration
- Limited recovery from crashes

### OpenHands Approach: Structured Event-Sourced Architecture

| Aspect | Claude Code Teams | OpenHands |
|--------|-------------------|-----------|
| **Spawning** | Fire-and-forget subprocess | Explicit agent lifecycle management |
| **Communication** | File-based inbox + settings.json | Type-safe event stream (JSON) |
| **Message Format** | Files on disk | Event objects + Pydantic validation |
| **State Model** | Process mutable state | Event-sourced immutable log |
| **Coordination** | Leader sends files, workers read/write | Parent waits on AgentDelegateAction observation |
| **Backend** | tmux -CC or in-process | Docker sandbox (configurable) |
| **Pause/Resume** | Process-level (kill/restart) | Resume from event log |
| **Serialization** | Implicit (file paths) | Explicit (JSON over network) |
| **Multi-Agent Parallelism** | Independent agents | Sub-agents share parent context |
| **Error Recovery** | Restart required | Replay event log |
| **Remote Deployment** | Difficult (process-bound) | Built-in RemoteConversation |

### Specific Architectural Contrasts

**State Management:**
- **Claude Code Teams:** Distributed files, eventual consistency
  ```
  leader.py         worker.py
      ↓                 ↓
  settings.json ← → inbox/messages/
      ↓                 ↓
   (shared disk)
  ```

- **OpenHands:** Centralized event log, strong consistency
  ```
  Parent Agent
      ↓
  ConversationState (single source of truth)
      ├─ messages[]
      ├─ actions[]
      └─ observations[]
      ↓
  Sub-agents inherit, read-only reference
  ```

**Communication Semantics:**
- **Claude Code Teams:** "Here's a file, process it" (implicit semantics)
- **OpenHands:** "Here's a typed action, execute and return observation" (explicit contract)

**Parallelism Model:**
- **Claude Code Teams:** Independent processes (true parallelism)
- **OpenHands:** Blocking delegation (structured, but sequential in current implementation)

---

## 7. Lessons for Provider-Agnostic Agent Orchestration

### 1. Event-Sourced State as Foundation

**Lesson:** Make state immutable and append-only from the start.

**Why:** Enables pause/resume, deterministic replay, remote serialization, and failure recovery without additional plumbing. Claude Code's file-based approach would benefit from this.

**Implementation pattern:**
```python
class OrchestratorState:
    events: List[Event]  # Immutable log
    
    def apply_event(self, event: Event) -> "OrchestratorState":
        # Return new state (don't mutate)
        new_state = copy(self)
        new_state.events.append(event)
        return new_state
```

### 2. Type-Safe Action-Observation Contract

**Lesson:** Define strict Pydantic schemas for all agent actions.

**Why:** Enables validation before execution, automatic schema export, and tool discovery (MCP).

```python
class BaseAction(BaseModel):
    """All actions inherit structure + validation."""
    timestamp: datetime
    agent_id: str
    action_type: Literal["bash", "edit", "delegate", ...]

class BashAction(BaseAction):
    command: str  # Validated: not empty, not dangerous
    timeout: int = 30
```

### 3. Workspace as Pluggable Interface

**Lesson:** Abstract execution environment behind WorkspaceInterface.

**Why:** Same agent code runs locally, in Docker, or remotely without changes.

```python
class BaseWorkspace(ABC):
    @abstractmethod
    def execute_bash(self, cmd: str) -> Observation: ...
    
    @abstractmethod
    def read_file(self, path: str) -> str: ...
    
    @abstractmethod
    def write_file(self, path: str, content: str) -> void: ...

# Implementations:
LocalWorkspace()    # Direct filesystem/shell
RemoteWorkspace()   # HTTP/gRPC to remote
DockerWorkspace()   # Container execution
```

### 4. Multi-Agent as Tool Abstraction

**Lesson:** Treat agent delegation as a Tool, not a special case.

**Why:** Complex multi-agent patterns become user-defined, not framework-special-cased.

```python
# User defines orchestration without touching framework
@tool
def fan_out_parallel(tasks: List[str]) -> List[Result]:
    """Delegate multiple tasks in parallel."""
    return [delegate_to_agent(task) for task in tasks]

@tool
def pipeline(steps: List[str]) -> Result:
    """Chain agents sequentially."""
    result = None
    for step in steps:
        result = delegate_to_agent(step, input=result)
    return result
```

### 5. Built-in REST/WebSocket from Day 1

**Lesson:** Don't bolt on networking after. Design for distributed execution first.

**Why:** Remote deployment, multi-user, and browser UIs become natural consequences, not afterthoughts.

```python
# Agent logic is deployment-agnostic
class Agent:
    def step(self, state: State) -> State: ...

# Same code runs locally or over network
local_agent = Agent(workspace=LocalWorkspace())
remote_agent = RemoteConversation(
    agent=Agent(...),
    server_url="http://agent-server:8000"
)
```

### 6. Evaluation Framework as First-Class

**Lesson:** Benchmark support should not be added last; design for testability.

**Why:** Enables comparative analysis, prevents perf regressions, validates research claims.

```python
@dataclass
class EvaluationTask:
    description: str
    initial_state: State
    success_criteria: Callable[[State], bool]
    user_response_fn: Callable[[str], str]  # Simulate user interaction

# Evaluation harness runs identical task across agent versions
results = evaluate(
    tasks=[...],
    agent_versions=[v1, v2],
    benchmarks=["swe_bench", "webarena"]
)
```

### 7. Provider-Agnostic via LLM Interface

**Lesson:** Agent logic should be model-agnostic. Define LLM contract, not implementation.

**Why:** Supports Claude, GPT, Llama, etc. without core changes. MCP integration follows naturally.

```python
class LLMInterface(ABC):
    @abstractmethod
    def query(
        self,
        messages: List[Message],
        tools: List[Tool],
        temperature: float = 0.7
    ) -> LLMResponse: ...

# Implementations swappable
ClaudeLLM(model="claude-opus-4.6")
OpenAILLM(model="gpt-4o")
OllamaLLM(model="llama2")
```

### 8. Configuration Immutability

**Lesson:** Agent configuration (model, tools, skills) should be immutable at construction.

**Why:** Prevents runtime surprises, enables caching, supports serialization for remote execution.

```python
# Bad (mutable configuration)
agent = Agent()
agent.llm = new_model  # Surprise! Affects running agents

# Good (immutable)
agent = Agent(
    llm=ClaudeLLM(...),
    tools=[...],
    skills=[...],
    workspace=workspace
)
# To change: create new Agent instance
```

---

## 8. Key Links and Sources

### Official OpenHands Resources

- **Main Site:** https://openhands.dev/
- **GitHub Repository:** https://github.com/OpenHands/OpenHands
- **Documentation:** https://docs.openhands.dev/
- **Cloud Platform:** https://app.all-hands.dev/ (with $10 free credit)
- **Organization:** https://github.com/OpenHands (and legacy https://github.com/All-Hands-AI)

### Technical Papers & Publications

- **ICLR 2025 Paper:** [OpenHands: An Open Platform for AI Software Developers as Generalist Agents](https://openreview.net/pdf/95990590797cff8b93c33af989ecf4ac58bde9bb.pdf)
- **Software Agent SDK Paper:** [The OpenHands Software Agent SDK: A Composable and Extensible Foundation for Production Agents](https://arxiv.org/html/2511.03690v1)
- **Original OpenHands Paper (2407.16741):** https://arxiv.org/abs/2407.16741

### Key Documentation Links

- **Agent Architecture:** https://docs.openhands.dev/sdk/arch/agent
- **Sub-Agent Delegation Guide:** https://docs.openhands.dev/sdk/guides/agent-delegation
- **SDK Package Architecture:** https://docs.openhands.dev/sdk/arch/sdk
- **Local Agent Server:** https://docs.openhands.dev/sdk/guides/agent-server/local-server
- **MCP Integration:** https://docs.openhands.dev/sdk/guides/mcp
- **Docker Sandbox Documentation:** https://docs.openhands.dev/openhands/usage/sandboxes/docker
- **Evaluation Harness:** https://docs.openhands.dev/openhands/usage/developers/evaluation-harness

### Blog Posts & Articles

- **CodeAct 2.1 Release:** [OpenHands CodeAct 2.1: An Open, State-of-the-Art Software Development Agent](https://openhands.dev/blog/openhands-codeact-21-an-open-state-of-the-art-software-development-agent)
- **SWE-Bench Performance (Nov 2025):** [SOTA on SWE-Bench Verified with Inference-Time Scaling and Critic Model](https://openhands.dev/blog/sota-on-swe-bench-verified-with-inference-time-scaling-and-critic-model)
- **OpenHands Index (Jan 2026):** [Introducing the OpenHands Index](https://openhands.dev/blog/openhands-index)
- **AMD Partnership (2025):** [Local AI for Developers: OpenHands + AMD Bring Coding Agents to Your Workstation](https://www.amd.com/en/developer/resources/technical-articles/2025/OpenHands.html)
- **Comparison Reviews:** https://artificialanalysis.ai/insights/coding-agents-comparison

### Related Repositories

- **Software Agent SDK:** https://github.com/OpenHands/software-agent-sdk
- **Benchmarks:** https://github.com/OpenHands/benchmarks
- **OpenHands Cloud (Self-hosted):** https://github.com/All-Hands-AI/OpenHands-Cloud
- **Agent Computer Interface:** https://github.com/All-Hands-AI/openhands-aci

### Performance Benchmarks

- **SWE-Bench Leaderboard:** https://www.swebench.com/
- **SWE-Bench Verified Score:** 66.4% (Feb 2026, with critic model selection)
- **OpenHands Index:** Comprehensive multi-task evaluation framework

---

## 9. Code Examples & Architecture Diagrams

### Simple Agent Usage Example

```python
from openhands.sdk.agent import Agent
from openhands.sdk.llm import ClaudeLLM
from openhands.workspace import LocalWorkspace

# Create workspace
workspace = LocalWorkspace(base_dir="/tmp/project")

# Create agent with Claude
agent = Agent(
    llm=ClaudeLLM(model="claude-opus-4.6"),
    workspace=workspace,
    tools=[
        BashTool(),
        PythonTool(),
        EditorTool(),
        BrowserTool()
    ]
)

# Run single step (reasoning-action-observation cycle)
state = agent.step(
    state=ConversationState(
        messages=[
            UserMessage("Fix the failing test in tests/test_utils.py")
        ]
    )
)

# Check what the agent did
for event in state.events:
    if isinstance(event, Action):
        print(f"Agent action: {event}")
    elif isinstance(event, Observation):
        print(f"Result: {event}")
```

### Sub-Agent Delegation Example

```python
# Main agent delegates web browsing task to specialist
parent_agent = CodeActAgent(...)
browser_agent = BrowsingAgent(...)

# Parent creates delegation action
state = parent_agent.step(
    state=state,
    # ... LLM decides to delegate ...
)

# Action contains:
# AgentDelegateAction(
#     task="Navigate to https://example.com and extract pricing",
#     agent_name="BrowsingAgent",
#     workspace=parent_workspace  # Shared context
# )

# Framework:
# 1. Creates sub-agent conversation (inherits parent LLM config)
# 2. Runs browser_agent.step() in loop until task complete
# 3. Returns observation with results
# 4. Parent continues reasoning with observation
```

### Remote Deployment Example

```python
# Local development
local_agent = Agent(
    llm=...,
    workspace=LocalWorkspace()
)

# Same code, deployed remotely (no changes to agent logic)
remote_agent = RemoteConversation(
    agent=Agent(
        llm=...,
        workspace=RemoteWorkspace(server_url="http://agent-server:8000")
    )
)

# Both follow identical step() protocol
state = remote_agent.step(state)  # Serialized over HTTP/WebSocket
```

### Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenHands Platform                        │
└─────────────────────────────────────────────────────────────┘

   ┌─────────────────┐
   │   Frontend      │  (Browser, IDE, CLI)
   │  (React/TS)     │
   └────────┬────────┘
            │ REST/WebSocket
            │
   ┌────────▼────────────────────────────────────────┐
   │    FastAPI Agent Server (openhands.agent_server)│
   │  - Session management                           │
   │  - State serialization                          │
   │  - Multi-user support                           │
   └────────┬──────────────────────────────────────┬─┘
            │                                      │
       REST endpoint                        WebSocket stream
            │                                      │
   ┌────────▼─────────────────────────────────────▼───┐
   │         Core Agent Loop (openhands.sdk)          │
   │  ┌───────────────────────────────────────────┐   │
   │  │ Agent.step() (Reasoning-Action Cycle)    │   │
   │  │  1. Query LLM with ConversationState    │   │
   │  │  2. Parse response → Action/Message     │   │
   │  │  3. Execute Tool (BashTool, etc.)       │   │
   │  │  4. Generate Observation                │   │
   │  │  5. Update ConversationState            │   │
   │  └───────────────────────────────────────────┘   │
   │                                                    │
   │  ┌────────────────────────────────────────────┐  │
   │  │ ConversationState (Event-Sourced)         │  │
   │  │  - messages[]                             │  │
   │  │  - actions[]                              │  │
   │  │  - observations[]                         │  │
   │  │  (Immutable, fully serializable)          │  │
   │  └────────────────────────────────────────────┘  │
   │                                                    │
   │  ┌────────────────────────────────────────────┐  │
   │  │ Tool System (openhands.tools)              │  │
   │  │  - BashTool → Bash commands                │  │
   │  │  - PythonTool → Python code                │  │
   │  │  - EditorTool → File edits                 │  │
   │  │  - BrowserTool → Web interaction           │  │
   │  │  - AgentDelegateTool → Sub-agents          │  │
   │  │  - MCP Tools → External services           │  │
   │  └────────────────────────────────────────────┘  │
   └────────┬────────────────────────────────────────┘
            │
            │ Tool execution requests
            │ (type-safe Action objects)
            │
   ┌────────▼────────────────────────────────────────┐
   │    Workspace Interface (openhands.workspace)    │
   │ ┌────────────┬────────────┬────────────┐         │
   │ │  Local     │  Remote    │   Docker   │         │
   │ │ Workspace  │ Workspace  │ Workspace  │         │
   │ │ (FS/shell) │ (HTTP/gRPC)│(Container) │         │
   │ └────────────┴────────────┴────────────┘         │
   └────────┬────────────────────────────────────────┘
            │
            │ Tool execution
            │
   ┌────────▼────────────────────────────────────────┐
   │   Action Execution (Sandbox/Docker Container)  │
   │  - Bash shell                                   │
   │  - Python interpreter                          │
   │  - File system                                  │
   │  - Environment (isolated)                       │
   └────────────────────────────────────────────────┘
```

---

## 10. Summary: OpenHands as a Reference Architecture

### Strengths for Agent Orchestration

1. **Event-sourced state** enables pause/resume and deterministic execution
2. **Type-safe actions** with Pydantic validation prevent invalid operations
3. **Pluggable workspaces** support local, remote, and containerized execution
4. **Multi-agent as tools** allows complex orchestration without framework changes
5. **Production-ready infrastructure** (FastAPI, WebSocket, session management)
6. **MCP integration** provides dynamic, external tool discovery
7. **Rigorous evaluation** framework ensures performance validation
8. **Provider-agnostic design** supports Claude, GPT, Llama, etc.

### Potential Improvements for Your Use Case

1. **Sub-agent blocking vs. async:** Current OpenHands waits for sub-agents. Consider enabling true parallel delegation for fan-out patterns.

2. **Shared workspace semantics:** Define what state sub-agents can read/write. OpenHands shares full workspace; Claude Code Teams use explicit file inbox.

3. **Task tracking:** OpenHands lacks explicit task management. Consider embedding checkpoint-based progress tracking in ConversationState.

4. **Tmux integration:** OpenHands uses Docker; you use tmux. Both valid, but Docker provides better isolation. Consider hybrid support.

5. **Leader-worker communication:** OpenHands uses event streams; Claude Code Teams use files. Event streams are more structured and enable better validation.

### Recommendations for Claude Code Agent Teams Evolution

1. **Adopt event-sourced state** over file-based inbox
2. **Define typed action contracts** (Pydantic models) instead of implicit file semantics
3. **Support pause/resume** by storing ConversationState durably
4. **Enable remote deployment** with built-in HTTP/WebSocket (like agent_server)
5. **Make sub-agent delegation first-class** (like AgentDelegateAction) rather than implicit
6. **Integrate MCP** for dynamic external tool discovery

---

## 11. Appendix: Technical Glossary

| Term | Definition |
|------|-----------|
| **Action** | Agent-proposed operation (bash, edit, delegate) with validated input |
| **Observation** | Environmental feedback from action execution |
| **ConversationState** | Single source of truth containing messages, actions, observations |
| **Event Stream** | Immutable, append-only log of all messages, actions, observations |
| **Workspace** | Execution environment interface (Local/Remote/Docker) |
| **CodeAct** | Unified agent control plane embedding code execution in LLM responses |
| **Sub-agent Delegation** | Parent agent spawns child agent to handle specialized subtask |
| **MCP** | Model Context Protocol for dynamic external tool discovery |
| **RemoteConversation** | Agent execution delegated to remote server over HTTP/WebSocket |
| **Agent Server** | FastAPI-based service managing agent sessions and state |
| **Pydantic Validation** | Type-safe schema validation for Actions before execution |
| **Deterministic Replay** | Reproduce identical execution by replaying event log |

---

**Report compiled:** February 16, 2026  
**Research methodology:** Comprehensive web search, official documentation review, academic paper analysis, GitHub repository inspection  
**Confidence level:** High (based on official docs, peer-reviewed ICLR 2025 publication, active project with 67.9k stars)

