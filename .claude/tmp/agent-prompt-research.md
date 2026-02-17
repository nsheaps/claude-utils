# Agent Prompt Best Practices — Comprehensive Research

Thorough reference for building effective `.claude/agents/` files, system prompts, orchestration patterns, and shared documentation strategies.

**Researcher**: Road Runner (Researcher)
**Date**: 2026-02-16
**Status**: Complete (expanded)
**Team**: looney-tunes

---

## Table of Contents

1. [Agent File Format & Frontmatter](#1-agent-file-format--frontmatter)
2. [@References, Shared Content & Template Variables](#2-references-shared-content--template-variables)
3. [System Prompt Structure & Patterns](#3-system-prompt-structure--patterns)
4. [Auto-Delegation & Description Field](#4-auto-delegation--description-field)
5. [Anti-Patterns to Avoid](#5-anti-patterns-to-avoid)
6. [Real-World Examples from Community & Marketplace](#6-real-world-examples-from-community--marketplace)
7. [Claude Agent SDK — Programmatic Agents](#7-claude-agent-sdk--programmatic-agents)
8. [Community Collections & Marketplaces](#8-community-collections--marketplaces)
9. [Framework Comparisons (CrewAI, AutoGen, LangGraph)](#9-framework-comparisons-crewai-autogen-langgraph)
10. [Behavioral Ideas from User Notes](#10-behavioral-ideas-from-user-notes)
11. [Recommendations for agent-team Project](#11-recommendations-for-agent-team-project)
12. [Sources](#12-sources)

---

## 1. Agent File Format & Frontmatter

### Structure

Agent files are Markdown with YAML frontmatter:

```markdown
---
name: agent-identifier
description: When Claude should delegate to this agent
tools: ["Tool1", "Tool2"]
model: sonnet
color: blue
---

System prompt content in Markdown.
```

- **Location**: `.claude/agents/` (project) or `~/.claude/agents/` (user) or plugin `agents/` dir
- **Extension**: `.md`
- **Auto-loading**: Agents loaded at session start; `/agents` to reload

### Agent Scopes & Priority

| Location | Scope | Priority | Created via |
|:---------|:------|:---------|:------------|
| `--agents` CLI flag | Current session | 1 (highest) | JSON on launch |
| `.claude/agents/` | Current project | 2 | `/agents` or manual |
| `~/.claude/agents/` | All projects | 3 | `/agents` or manual |
| Plugin `agents/` dir | Where enabled | 4 (lowest) | Plugin install |

### Frontmatter Fields

#### Required

| Field | Type | Description |
|:------|:-----|:------------|
| `name` | string | Unique ID: lowercase, numbers, hyphens, 3-50 chars. Must start/end with alphanumeric. |
| `description` | string | When to delegate. Include `<example>` blocks for auto-triggering. 10-5,000 chars. |

#### Optional

| Field | Type | Default | Description |
|:------|:-----|:--------|:------------|
| `tools` | array | all | Allowlist of tools |
| `disallowedTools` | array | none | Denylist of tools |
| `model` | string | `inherit` | `haiku`, `sonnet`, `opus`, `inherit` |
| `color` | string | none | `blue`, `cyan`, `green`, `yellow`, `magenta`, `red` |
| `permissionMode` | string | `default` | `default`, `acceptEdits`, `delegate`, `plan`, `dontAsk`, `bypassPermissions` |
| `maxTurns` | number | none | Max agentic turns before stopping |
| `skills` | array | none | Skills to preload into agent context |
| `mcpServers` | array/object | none | MCP servers available to agent |
| `hooks` | object | none | Lifecycle hooks scoped to agent |
| `memory` | string | none | `user`, `project`, or `local` |

### Tool Restrictions

```yaml
# Allowlist — only these tools available
tools: ["Read", "Grep", "Glob", "Bash"]

# Denylist — remove specific tools from inherited set
disallowedTools: ["Write", "Edit"]

# Restrict which subagents can be spawned
tools: ["Task(worker, researcher)", "Read", "Bash"]

# No subagent spawning
tools: ["Read", "Bash", "Write"]  # No Task = cannot spawn subagents
```

**CRITICAL**: Subagents cannot spawn their own subagents. Don't include `Task` in a subagent's `tools` array.

### Model Selection Guidelines

| Model | Best For | Token Cost |
|:------|:---------|:-----------|
| `haiku` | Fast read-only tasks, exploration, search, test execution | Lowest |
| `sonnet` | Code review, analysis, balanced tasks, data analysis | Medium |
| `opus` | Complex reasoning, critical decisions, orchestration, architecture | Highest |
| `inherit` | Default — uses parent's model | Same as parent |

### Color Conventions

| Color | Semantic |
|:------|:---------|
| `blue`/`cyan` | Analysis, review, research |
| `green` | Generation, creation, success |
| `yellow` | Validation, caution, warnings |
| `red` | Security, critical, destructive |
| `magenta` | Creative, transformation |

### Permission Mode Patterns

| Mode | Behavior | Use Case |
|:-----|:---------|:---------|
| `default` | Standard prompts for everything | General-purpose agents |
| `acceptEdits` | Auto-approves file edits, asks for other actions | Trusted development workflows |
| `plan` | Read-only exploration | Researcher, read-only analysis |
| `delegate` | Coordination-only (restricts to Task tool) | Orchestrators that don't implement |
| `dontAsk` | Auto-deny prompts (allowed tools still work) | Automated pipelines |
| `bypassPermissions` | Skips all checks | CI/CD only; dangerous for interactive |

### Memory Scopes

| Scope | Location | Use Case |
|:------|:---------|:---------|
| `user` | `~/.claude/agent-memory/{name}/MEMORY.md` | Cross-project knowledge |
| `project` | `.claude/agent-memory/{name}/MEMORY.md` | Team shared knowledge |
| `local` | `.claude/agent-memory-local/{name}/MEMORY.md` | Project-specific, not in VCS |

---

## 2. @References, Shared Content & Template Variables

### In CLAUDE.md — Fully Supported

```markdown
See @README for project overview
@docs/git-instructions.md
```

- Paths resolve **relative to the file containing the import**
- Max depth: 5 hops (recursive)
- Not evaluated inside code blocks
- One-time approval dialog per project

### In Agent Files — Not Officially Documented

The official docs don't explicitly confirm `@reference` support in `.claude/agents/*.md` files. However:

- Agent files can use directory-based patterns:
  ```
  .claude/agents/my-agent/
    agent.md
    references/checklist.md
    scripts/validate.sh
  ```
- Agent prompts can instruct the agent to read specific files at runtime
- **Recommendation**: Place shared content in `.claude/docs/` and reference via CLAUDE.md. Agents inherit CLAUDE.md context, so they'll see these docs.

### In Skills — `!` Backtick Syntax

Skills support dynamic content injection:
```markdown
- PR diff: !`gh pr diff`
- Changed files: !`gh pr diff --name-only`
```
- **NOT available** in agent files or CLAUDE.md
- Executes before Claude sees the prompt
- Source: [Skills docs](https://code.claude.com/docs/en/skills#inject-dynamic-context)

### Template Variables

| Variable | Where | Status |
|:---------|:------|:-------|
| `{{CURRENT_DATE}}` | System context | Available but undocumented for direct use |
| `$ARGUMENTS`, `$0`, `$1` | Skills only | Fully documented |
| `${CLAUDE_SESSION_ID}` | Skills only | Fully documented |
| `${CLAUDE_PLUGIN_ROOT}` | Plugin skills/hooks only | Fully documented |
| `{{PROJECT_NAME}}`, etc. | Anywhere | NOT documented — do not rely on |

**Key finding**: No confirmed template variables for agent file bodies or frontmatter.

### Shared Docs Pattern (Recommended)

```
.claude/
  docs/
    team-rules.md          # Common behavioral rules
    communication.md       # How teammates communicate
    failure-modes.md       # Expected failure patterns
    quality-standards.md   # What "done" means
  agents/
    team-coach.md          # Inherits docs via CLAUDE.md
    software-engineer.md
    researcher.md
```

Reference from CLAUDE.md:
```markdown
@docs/team-rules.md
@docs/communication.md
```

---

## 3. System Prompt Structure & Patterns

### The Effective Prompt Pattern

Based on analysis of 7+ production agent files and community collections, effective system prompts follow this structure:

1. **Role statement** — "You are [expert role] specializing in [domain]"
2. **Core responsibilities** — numbered list, 3-8 items
3. **Detailed process** — step-by-step workflow
4. **Quality standards** — what "good" looks like
5. **Output format** — expected structure of results
6. **Edge case handling** — what to do when things go wrong

**Optimal length**: 500-3,000 words body. Under 5,000 words total including references.

### Role Statement Patterns

```markdown
# Good — specific and bounded
You are a senior code reviewer ensuring high standards of code quality and security.

# Good — domain-specific
You are a data scientist specializing in SQL and BigQuery analysis.

# Good — with boundaries
You are a feature coordinator that orchestrates work across specialized agents.
You coordinate but do not implement. Use specialist agents for actual work.

# Bad — vague
You are a helpful assistant.

# Bad — too broad
You are an expert in everything.
```

### Process/Workflow Patterns

Always provide numbered steps:

```markdown
When invoked:
1. Capture error message and stack trace
2. Identify reproduction steps
3. Isolate the failure location
4. Implement minimal fix
5. Verify solution works
```

### Output Format Patterns

```markdown
# Prioritized feedback
Provide feedback organized by priority:
- Critical issues (must fix)
- Warnings (should fix)
- Suggestions (consider improving)

Include specific examples of how to fix issues.

# Structured report
For each analysis:
- Explain the query approach
- Document any assumptions
- Highlight key findings
- Suggest next steps based on data
```

### Progressive Disclosure Pattern

From community best practices (VoltAgent, wshobson):
- Minimal frontmatter — only essential metadata
- Rich markdown body for detailed instructions
- Skills preloaded for domain knowledge (not baked into prompt)
- Average 3.4 components per plugin for token efficiency

```markdown
---
name: api-architect
description: Design REST and GraphQL APIs following best practices
tools: Read, Write
skills:
  - api-design-patterns
  - authentication-patterns
---

You are an API architect. Consult preloaded skills for patterns.

[Minimal core instructions — skills provide the details]
```

---

## 4. Auto-Delegation & Description Field

### How Claude Decides When to Delegate

Claude auto-delegates based on:
1. **Task description** in user request
2. **Agent description** field (most critical)
3. **`<example>` blocks** in description
4. **Current context** and available tools

### Description Best Practices

The `description` field is the **primary signal** Claude uses for auto-delegation.

**Must include:**
1. **Trigger phrase**: "Use this agent when..."
2. **2-4 `<example>` blocks** with context, user message, assistant response, commentary
3. **Proactive AND reactive** triggering scenarios

```yaml
description: |
  Use this agent when [conditions]. Examples:

  <example>
  Context: [Situation]
  user: "[Request]"
  assistant: "[Response using agent]"
  <commentary>
  [Why agent triggers]
  </commentary>
  </example>
```

### Trigger Keyword Patterns

**Critical keywords** to include:

| Keyword | Effect |
|:--------|:-------|
| `PROACTIVELY` | Triggers without explicit user request |
| `MUST BE USED` | Enforces mandatory delegation |
| `Use immediately` | Triggers right after condition met |
| `Expert [role]` | Signals specialization |
| `Use when` | Conditional trigger |

### Trigger Pattern Templates

**Template 1: Proactive specialist**
```yaml
description: "[Role] specialist. Use PROACTIVELY [when/after X]. Focus on [specific concerns]."
```

**Template 2: Must-use enforcer**
```yaml
description: "MUST BE USED to [action] whenever [condition]. Ensures [outcome]."
```

**Template 3: Immediate responder**
```yaml
description: "[Expert role]. Use immediately [trigger event]. Handles [scope]."
```

### Examples from Production

**From VoltAgent collection:**
```yaml
name: code-reviewer
description: "Code quality guardian. Use PROACTIVELY after code changes to check security, style, and maintainability"
```

**From official docs:**
```yaml
name: code-reviewer
description: "Expert code review specialist. Proactively reviews code for quality, security, and maintainability. Use immediately after writing or modifying code."
```

**With full `<example>` blocks (from github-issue-creator):**
```yaml
description: |
  Use this agent when the user explicitly requests to create GitHub issues, or when bugs, problems,
  or future tasks are identified that should be tracked separately.

  <example>
  Context: During a code review, user discovers a potential memory leak
  user: "I noticed there might be a memory leak in the parser, but let's fix that later"
  assistant: "I'll use the github-issue-creator agent to create an issue for tracking this."
  <commentary>
  User identified a problem that should be tracked separately.
  </commentary>
  </example>
```

---

## 5. Anti-Patterns to Avoid

### Description Anti-Patterns

| Anti-Pattern | Why It's Bad | Fix |
|:-------------|:-------------|:----|
| `"Helps with code"` | Too vague, never triggers | Be specific: "Reviews Python code for security vulnerabilities" |
| No `<example>` blocks | Claude can't match trigger conditions | Add 2-4 examples with context |
| Only reactive triggers | Misses proactive use cases | Add "Use PROACTIVELY after..." |
| Over-broad scope | Conflicts with other agents | Narrow to specific domain |

### System Prompt Anti-Patterns

| Anti-Pattern | Why It's Bad | Fix |
|:-------------|:-------------|:----|
| First person ("I am...") | Confuses role assignment | Use second person ("You are...") |
| No workflow steps | Agent improvises inconsistently | Provide numbered process |
| No output format | Unstructured, hard-to-parse results | Define expected structure |
| Over 5,000 words | Token waste, dilutes key instructions | Keep 500-3,000 words, use skills for details |
| Embedding all domain knowledge in prompt | Bloats context | Use `skills:` preloading instead |
| No edge case handling | Agent fails silently on unusual input | Include "When X happens, do Y" |

### Tool Configuration Anti-Patterns

| Anti-Pattern | Why It's Bad | Fix |
|:-------------|:-------------|:----|
| Granting all tools to every agent | Violates least privilege | Allowlist only needed tools |
| Including `Task` in subagent tools | Subagents can't spawn subagents | Remove `Task` from subagent tool lists |
| No hooks for dangerous operations | Unsafe commands can execute | Add `PreToolUse` hooks with validation |
| `bypassPermissions` for interactive use | No safety checks | Use `acceptEdits` or `default` instead |

### Behavioral Anti-Patterns

| Anti-Pattern | Why It's Bad | Fix |
|:-------------|:-------------|:----|
| Agent implements AND coordinates | Confused responsibilities | Separate coordinator (delegate mode) from workers |
| No memory configuration | Loses learnings between sessions | Set `memory: project` or `memory: user` |
| Agent with vague model selection | Wastes tokens or too slow | Choose model deliberately per task type |
| Same color for all agents | Hard to distinguish in UI | Use semantic color conventions |

---

## 6. Real-World Examples from Community & Marketplace

### Example 1: Code Reviewer (Read-Only)

**Source**: Official docs + multiple community repos

```markdown
---
name: code-reviewer
description: Expert code review specialist. Proactively reviews code for quality, security,
  and maintainability. Use immediately after writing or modifying code.
tools: Read, Grep, Glob, Bash
model: inherit
color: cyan
---

You are a senior code reviewer ensuring high standards of code quality and security.

When invoked:
1. Run git diff to see recent changes
2. Focus on modified files
3. Begin review immediately

Review checklist:
- Code is clear and readable
- Functions and variables are well-named
- No duplicated code
- Proper error handling
- No exposed secrets or API keys
- Input validation implemented
- Good test coverage
- Performance considerations addressed

Provide feedback organized by priority:
- Critical issues (must fix)
- Warnings (should fix)
- Suggestions (consider improving)

Include specific examples of how to fix issues.
```

**Patterns used**: Read-only tools, explicit workflow, structured checklist, prioritized output.

### Example 2: Debugger (Read-Write)

**Source**: Official docs

```markdown
---
name: debugger
description: Debugging specialist for errors, test failures, and unexpected behavior.
  Use proactively when encountering any issues.
tools: Read, Edit, Bash, Grep, Glob
color: red
---

You are an expert debugger specializing in root cause analysis.

When invoked:
1. Capture error message and stack trace
2. Identify reproduction steps
3. Isolate the failure location
4. Implement minimal fix
5. Verify solution works

For each issue, provide:
- Root cause explanation
- Evidence supporting the diagnosis
- Specific code fix
- Testing approach
- Prevention recommendations

Focus on fixing the underlying issue, not the symptoms.
```

**Patterns used**: Read + Edit for diagnosis/fixes, evidence-based approach, prevention mindset.

### Example 3: Database Query Validator (Hook-Based Security)

**Source**: Official docs

```markdown
---
name: db-reader
description: Execute read-only database queries. Use when analyzing data or generating reports.
tools: Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-query.sh"
---

You are a database analyst with read-only access. Execute SELECT queries only.

When asked to analyze data:
1. Identify which tables contain the relevant data
2. Write efficient SELECT queries with appropriate filters
3. Present results clearly with context

You cannot modify data. If asked to INSERT, UPDATE, DELETE, or modify schema,
explain that you only have read access.
```

**Patterns used**: `PreToolUse` hook for conditional validation, exit code 2 to block execution, security through validation.

### Example 4: Multi-Agent Coordinator (Delegate Mode)

**Source**: Community collections

```markdown
---
name: feature-coordinator
description: Coordinates multiple specialized agents to implement complete features.
  Use for complex, multi-step development tasks.
tools: Task
permissionMode: delegate
model: opus
color: magenta
---

You are a feature coordinator that orchestrates work across specialized agents.

When given a feature request:
1. Break down into discrete tasks
2. Identify appropriate specialist agents for each task
3. Delegate to agents in optimal order
4. Synthesize results into coherent implementation

Coordination approach:
- Analyze dependencies between tasks
- Run independent work in parallel when possible
- Ensure consistent architecture across agents
- Validate integration points
- Maintain overall feature coherence

You coordinate but do not implement. Use specialist agents for actual work.
```

**Patterns used**: `delegate` mode, `Task`-only tools, Opus for reasoning, clear coordinator vs worker separation.

### Example 5: Agent with Persistent Memory

**Source**: Community patterns

```markdown
---
name: codebase-expert
description: Maintains knowledge about codebase patterns, conventions, and architecture.
  Use for guidance on project structure.
tools: Read, Grep, Glob, Bash, Write, Edit
memory: project
color: blue
---

You are a codebase expert who builds institutional knowledge over time.

When invoked:
1. Consult your memory in `.claude/agent-memory/codebase-expert/MEMORY.md`
2. Apply learned patterns to the current task
3. Update memory with new discoveries

Memory management:
- Record architectural decisions
- Document module relationships
- Note recurring patterns
- Track key file locations
- Capture design principles

After each task:
- Update MEMORY.md with new learnings
- Curate if approaching 200 lines
- Preserve most valuable insights
```

**Patterns used**: `memory: project` for shared team knowledge, explicit memory consultation, self-curation.

### Example 6: Agile Team Structure (valllabh/claude-agents)

Full team of agents modeling an agile team:

| Agent | Role | Model |
|:------|:-----|:------|
| `analyst` | Business/data analysis | sonnet |
| `architect` | System architecture | opus |
| `developer` | Implementation | sonnet |
| `product-manager` | Product strategy | opus |
| `product-owner` | Requirements management | sonnet |
| `qa-engineer` | Quality assurance | sonnet |
| `scrum-master` | Agile facilitation | sonnet |
| `ux-expert` | User experience design | sonnet |

**Pattern**: Domain specialization with appropriate model selection per role complexity.

---

## 7. Claude Agent SDK — Programmatic Agents

### Overview

The Claude Agent SDK (Python + TypeScript) enables programmatic agent definition as an alternative to `.claude/agents/` markdown files. Same tools and agent loop as Claude Code, but code-defined.

### Key Differences: Agent Files vs SDK

| Aspect | `.claude/agents/` files | SDK `agents` parameter |
|:-------|:------------------------|:----------------------|
| **Definition** | Markdown files | Code objects |
| **Loading** | Automatic at startup | Programmatic per query |
| **Persistence** | Filesystem (git-tracked) | Session-specific (code-tracked) |
| **Dynamic creation** | Manual file creation | Runtime generation |
| **Type safety** | No | Yes (TypeScript) |
| **Precedence** | Lower | Higher (overrides same-name files) |

### SDK Agent Definition

```typescript
options: {
  agents: {
    "code-reviewer": {
      description: "Expert code review specialist",
      prompt: "You are a code review specialist...",
      tools: ["Read", "Grep", "Glob"],
      model: "sonnet"
    }
  }
}
```

### System Prompt Methods in SDK

| Method | Persistence | Customization | Default Tools |
|:-------|:-----------|:-------------|:-------------|
| CLAUDE.md files | Per-project | Additions only | Preserved |
| Output styles | Saved files | Replace default | Preserved |
| `systemPrompt.append` | Session only | Additions only | Preserved |
| Custom `systemPrompt` string | Session only | Complete control | Lost (must include) |

**CRITICAL**: SDK uses a **minimal system prompt** by default. Must use `systemPrompt: { preset: "claude_code" }` to get the full Claude Code prompt.

### SDK Hooks (Programmatic)

The SDK provides programmatic hooks not available in file-based agents:

| Hook | Python | TypeScript | Use |
|:-----|:-------|:-----------|:----|
| `PreToolUse` | Yes | Yes | Block/modify tool calls |
| `PostToolUse` | Yes | Yes | Log/transform results |
| `PostToolUseFailure` | No | Yes | Error handling |
| `SubagentStart` | No | Yes | Track parallel tasks |
| `SubagentStop` | Yes | Yes | Aggregate results |
| `SessionStart` | No | Yes | Initialize logging |
| `SessionEnd` | No | Yes | Cleanup resources |
| `Notification` | No | Yes | External alerts |
| `PermissionRequest` | No | Yes | Custom permission flows |

### MCP Integration Patterns

**Inline MCP server in agent frontmatter:**
```yaml
mcpServers:
  slack:
    type: stdio
    command: npx
    args: ["-y", "@modelcontextprotocol/server-slack"]
    env:
      SLACK_BOT_TOKEN: "${SLACK_BOT_TOKEN}"
    tools:
      - slack_list_channels
      - slack_post_message
```

**Reference existing server from settings.json:**
```yaml
mcpServers:
  - github  # References server configured in settings.json
```

**SDK in-process custom tools:**
```typescript
const customServer = createSdkMcpServer({
  name: "my-tools",
  version: "1.0.0",
  tools: [
    tool("my_action", "Description", { param: z.string() }, async (args) => {
      return { content: [{ type: "text", text: "result" }] };
    })
  ]
});
```

### Sources

- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Subagents Documentation](https://platform.claude.com/docs/en/agent-sdk/subagents)
- [Hooks Documentation](https://platform.claude.com/docs/en/agent-sdk/hooks)
- [Custom Tools Guide](https://platform.claude.com/docs/en/agent-sdk/custom-tools)
- [Python SDK](https://github.com/anthropics/claude-agent-sdk-python)
- [TypeScript SDK](https://github.com/anthropics/claude-agent-sdk-typescript)
- [Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)

---

## 8. Community Collections & Marketplaces

### Official Marketplaces

| Marketplace | URL | Description |
|:-----------|:----|:-----------|
| Claude Code Plugin Marketplace | [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) | Official Anthropic-managed |
| Anthropic Skills Repo | [anthropics/skills](https://github.com/anthropics/skills) | Official agent skills |
| claude-plugins.dev | [claude-plugins.dev](https://claude-plugins.dev/) | Community CLI registry |
| claudemarketplaces.com | [claudemarketplaces.com](https://claudemarketplaces.com/) | Community marketplace |
| AgentSkills.io | [agentskills.io](https://agentskills.io/) | Open standard, cross-tool |

### Major Agent Collections

| Collection | Size | Notable Feature |
|:----------|:-----|:---------------|
| [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) | 127+ agents | 10 categories, marketplace install |
| [wshobson/agents](https://github.com/wshobson/agents) | 112 agents, 73 plugins | Three-tier model strategy, progressive disclosure |
| [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) | 300+ skills | AgentSkills.io compatible |
| [vizra-ai/claude-code-agents](https://github.com/vizra-ai/claude-code-agents) | 59 agents | System architecture to marketing |
| [valllabh/claude-agents](https://github.com/valllabh/claude-agents) | 8 agents | Agile team structure |
| [davila7/claude-code-templates](https://github.com/davila7/claude-code-templates) | 100+ templates | Interactive web UI |

### Installation Methods

```bash
# 1. Plugin marketplace (recommended)
/plugin marketplace add voltagent
/plugin install voltagent-core-dev

# 2. Manual copy
cp agent-file.md .claude/agents/

# 3. Git clone
git clone https://github.com/user/agents ~/.claude/agents/

# 4. CLI flag (session-only testing)
claude --agents '{"test-agent": {"description": "...", "prompt": "..."}}'
```

### Creative Community Techniques

1. **Hook-based automation**: SessionStart loads context, PostToolUse auto-formats, SubagentStop cleans up
2. **Progressive disclosure**: Minimal frontmatter + skills preloading for token efficiency
3. **Task spawning restrictions**: `tools: ["Task(researcher, code-writer, tester)"]`
4. **Conditional tool access via hooks**: PreToolUse scripts validate before execution
5. **Skills preloading**: Give agent domain knowledge at startup without baking it into prompt
6. **Three-tier model strategy**: Route tasks to haiku/sonnet/opus by complexity

### Orchestration Tools

| Tool | URL | Approach |
|:-----|:----|:---------|
| Auto-Claude | [AndyMik90/Auto-Claude](https://github.com/AndyMik90/Auto-Claude) | Multi-agent SDLC with kanban |
| Claude Squad | [smtg-ai/claude-squad](https://github.com/smtg-ai/claude-squad) | Multiple agents in workspaces |
| TSK | [dtormoen/tsk](https://github.com/dtormoen/tsk) | Sandboxed Docker task environment |
| Ralph pattern | [frankbria/ralph-claude-code](https://github.com/frankbria/ralph-claude-code) | Iterative with guardrails |

---

## 9. Framework Comparisons (CrewAI, AutoGen, LangGraph)

### Comparison with Claude Code Agent Teams

| Dimension | Claude Code Agents | CrewAI | AutoGen | LangGraph |
|:----------|:-------------------|:-------|:--------|:----------|
| **Definition** | Markdown + YAML frontmatter | Python classes | Python classes | State graphs |
| **Orchestration** | Built-in team primitives | Sequential/hierarchical/consensus | GroupChat + managers | Directed graph |
| **Communication** | SendMessage peer-to-peer | Delegation framework | Conversation threads | State passing |
| **Coordination** | Shared task list, self-claiming | Crew-level task assignment | AutoGen orchestrator | Graph edges |
| **Tool definition** | Built-in + MCP | Python @tool decorator | Function calling | LangChain tools |
| **Context management** | Automatic compaction | Manual | Conversation memory | Checkpoints |
| **Model agnostic** | Claude only (today) | Multi-provider | Multi-provider | Multi-provider |
| **Setup complexity** | Zero (markdown files) | Python project | Python project | Python project |
| **Production readiness** | Experimental | Production | Production | Production |

### Key Patterns Transferable from Frameworks

**From CrewAI:**
- **Role-Goal-Backstory pattern**: Each agent has explicit role, goal, and backstory. Maps to Claude's role statement + description + system prompt body.
- **Sequential vs hierarchical processes**: Claude Code supports both via task dependencies (sequential) and delegate mode (hierarchical).
- **Delegation**: CrewAI's `allow_delegation=True` maps to including `Task` in tools.

**From AutoGen:**
- **GroupChat pattern**: Multiple agents converse freely. Claude Code's `SendMessage` broadcast + peer DMs achieves similar.
- **Human-in-the-loop**: AutoGen's human proxy maps to Claude Code's permission modes and plan approval.
- **Nested conversations**: AutoGen's nested chats map to Claude Code's subagent spawning within teams.

**From LangGraph:**
- **State machines**: Graph-based workflows with conditional edges. Can be modeled in Claude Code via task dependencies + hooks.
- **Checkpointing**: LangGraph checkpoints state. Claude Code uses context compaction + session resume.
- **Tool nodes**: LangGraph treats tool execution as graph nodes. Claude Code's hooks provide similar interception points.

### What Claude Code Does Better

- **Zero-setup**: Markdown files vs Python project scaffolding
- **Integrated tooling**: File ops, search, web, code editing built-in
- **Automatic context management**: Compaction handles long conversations
- **Permission system**: Built-in security through permission modes and hooks

### What Frameworks Do Better

- **Model flexibility**: Multi-provider support (OpenAI, Anthropic, local)
- **Complex workflows**: Explicit state machines (LangGraph) for intricate flows
- **Mature ecosystem**: Battle-tested in production for longer
- **Custom memory**: More flexible memory management systems

---

## 10. Behavioral Ideas from User Notes

From `~/src/nsheaps/obsidian-vaults/ai ramblings.md` (read-only, DO NOT MODIFY):

### Team Rules (for agent prompts)

- **Assume human-like failure modes**: over-engineering, side quests, forgetting recent things, saying one thing and meaning another
- **Always use skills** — if one doesn't exist, make one before starting
- **Distinctions between concepts**:
  - Rules = entry points and do's/don'ts (system prompt)
  - Skills = "how to" with recall
  - Memories = "when to" in relation to context
  - Sub-agents within session = behaviors, "how to chain skills"
  - External agents (teams) = delegation for knowledge outside your role

### Agent Role Ideas

- team-coach, software-engineer, lead-researcher, quality-assurance, devops, project-manager, explore-tool
- Explore agent limitation: can read/search web but can't execute commands

### Rule/Behavior Ideas

- Don't enter plan mode, use Plan agent instead (consider `disallowedTools: ["EnterPlanMode"]`)
- Don't leave unhelpful comments, but ALWAYS add doc comments to exported functions
- Keep functions <20 lines, files <1000 lines
- Work iteratively, break tasks into small chunks, delegate to sub-agents
- If user asks clarifying question, focus on answering — DO NOT ACT
- Use `.claude/tmp/` instead of `/tmp/` for shared state
- Mixture-of-experts for PR review (multiple agents + codex)

### Hook Ideas

- No `git -C` or `cd && ...` chains
- No `&&` in bash, no `| tail` or `| head`
- Bash should dump to file for reading
- Post-tool-use hooks to track git state changes

---

## 11. Recommendations for agent-team Project

### Architecture: Shared Docs + Agent Files

```
.claude/
  CLAUDE.md              # Imports @docs/* for shared context
  docs/
    team-rules.md        # Common behavioral rules (all agents inherit)
    communication.md     # How teammates communicate
    failure-modes.md     # Human-like failure patterns to avoid
    quality-standards.md # What "done" means
  agents/
    team-coach.md        # Opus, delegate mode, coordinate + review
    software-engineer.md # Sonnet, full tools, implementation
    lead-researcher.md   # Opus, spawns sub-agents, synthesizes
    quality-assurance.md # Sonnet, read-only + bash for tests
    devops.md            # Sonnet, infra-focused tools
    project-manager.md   # Sonnet, task management + communication
```

### Agent File Best Practices Summary

1. **Name**: lowercase-hyphens, 3-50 chars, descriptive of role
2. **Description**: "Use this agent when..." + 2-4 `<example>` blocks with commentary
3. **Model**: Use `inherit` unless specific need (opus for orchestration, haiku for fast read-only)
4. **Tools**: Least privilege — only what the agent needs. No `Task` for leaf workers.
5. **Color**: Semantic convention — blue for research, green for creation, red for security
6. **Prompt structure**: Role → Responsibilities → Process → Quality → Output → Edge Cases
7. **Prompt length**: 500-3,000 words body. Under 5,000 total.
8. **Skills**: Preload domain knowledge via `skills:` rather than embedding in prompt
9. **Hooks**: Use PreToolUse for safety validation, PostToolUse for auto-formatting
10. **Memory**: Set `memory: project` for team-shared knowledge accumulation
11. **Behavioral rules**: Encode human failure mode awareness, iteration, delegation patterns

### Key Design Decisions

| Decision | Recommendation | Rationale |
|:---------|:---------------|:----------|
| Shared rules | `.claude/docs/` + CLAUDE.md imports | Agents inherit CLAUDE.md context |
| Domain knowledge | Skills preloading | Tokens efficient, reusable across agents |
| Safety | PreToolUse hooks + tool allowlists | Defense in depth |
| Coordination | delegate mode + Task-only tools | Clear coordinator vs worker separation |
| Memory | `memory: project` for shared knowledge | Team learning over time |
| Model routing | opus for leads, sonnet for workers, haiku for search | Cost-performance balance |

---

## 12. Sources

### Official Documentation

- [Create custom subagents](https://code.claude.com/docs/en/sub-agents)
- [Agent teams](https://code.claude.com/docs/en/agent-teams)
- [CLAUDE.md imports](https://code.claude.com/docs/en/memory#claude-md-imports)
- [Skills - Dynamic context injection](https://code.claude.com/docs/en/skills#inject-dynamic-context)
- [Settings](https://code.claude.com/docs/en/settings)
- [Hooks reference](https://code.claude.com/docs/en/hooks)
- [Plugin reference](https://code.claude.com/docs/en/plugins)
- [Full docs (llms.txt)](https://code.claude.com/docs/llms.txt)

### Claude Agent SDK

- [Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Subagents](https://platform.claude.com/docs/en/agent-sdk/subagents)
- [Hooks](https://platform.claude.com/docs/en/agent-sdk/hooks)
- [System Prompts](https://platform.claude.com/docs/en/agent-sdk/modifying-system-prompts)
- [Custom Tools](https://platform.claude.com/docs/en/agent-sdk/custom-tools)
- [MCP Integration](https://platform.claude.com/docs/en/agent-sdk/mcp)
- [Permissions](https://platform.claude.com/docs/en/agent-sdk/permissions)
- [Python SDK](https://github.com/anthropics/claude-agent-sdk-python)
- [TypeScript SDK](https://github.com/anthropics/claude-agent-sdk-typescript)
- [Building agents with the Claude Agent SDK (blog)](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)

### Community Collections

- [VoltAgent/awesome-claude-code-subagents](https://github.com/VoltAgent/awesome-claude-code-subagents) — 127+ agents
- [wshobson/agents](https://github.com/wshobson/agents) — 112 agents, 73 plugins
- [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) — 300+ skills
- [valllabh/claude-agents](https://github.com/valllabh/claude-agents) — Agile team structure
- [hesreallyhim/awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — Curated list
- [davila7/claude-code-templates](https://github.com/davila7/claude-code-templates) — 100+ templates
- [anthropics/claude-plugins-official](https://github.com/anthropics/claude-plugins-official) — Official plugins

### Marketplaces

- [claude-plugins.dev](https://claude-plugins.dev/)
- [claudemarketplaces.com](https://claudemarketplaces.com/)
- [AgentSkills.io](https://agentskills.io/)
- [BuildWithClaude](https://www.buildwithclaude.com/marketplaces)

### Community Guides

- [ClaudeLog: Custom Agents](https://claudelog.com/mechanics/custom-agents/)
- [Agent Skills Deep Dive](https://leehanchung.github.io/blogs/2025/10/26/claude-skills-deep-dive/)
- [eesel.ai hooks guide](https://www.eesel.ai/blog/hooks-in-claude-code)
- [PubNub: Best practices for subagents](https://www.pubnub.com/blog/best-practices-for-claude-code-sub-agents/)
- [vijaythecoder best practices](https://github.com/vijaythecoder/awesome-claude-agents/blob/main/docs/best-practices.md)
- [alexop.dev: Claude Code Customization Guide](https://alexop.dev/posts/claude-code-customization-guide-claudemd-skills-subagents/)
- [Steve Kinney course: Sub-agents](https://stevekinney.com/courses/ai-development/claude-code-sub-agents)

### GitHub Issues

- [#24316 - Custom agents as teammates](https://github.com/anthropics/claude-code/issues/24316)
- [#8501 - YAML frontmatter documentation](https://github.com/anthropics/claude-code/issues/8501)
- [#18212 - Custom agents support](https://github.com/anthropics/claude-code/issues/18212)

### Example Agent Files Analyzed

- `research-lead.md` — Opus orchestrator, spawns parallel subagents, synthesizes results
- `research-subagent.md` — Sonnet worker, OODA loop, focused investigation
- `github-issue-creator.md` — Sonnet, rich `<example>` blocks, proactive triggering
- `internet-researcher.md` — Haiku, web research with tiered source evaluation
- `ui-ux-consultant.md` — Read-only, platform guideline adherence + accessibility
- `agent-creator.md` — Sonnet, meta-agent for creating other agents
- `code-reviewer.md` — Sonnet, confidence-scored code review

### Supplementary Research Files

- `/tmp/agent-sdk-research.md` — Full Claude Agent SDK documentation (1,239 lines)
- `/tmp/community-agents-research.md` — Community collections deep dive (1,182 lines)
- `/Users/nathan.heaps/src/nsheaps/claude-utils/.claude/tmp/teammate-launch-research.md` — Teammate spawn mechanics (161 lines)
