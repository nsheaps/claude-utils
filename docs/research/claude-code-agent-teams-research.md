# Claude Code Agent Teams -- Comprehensive Research

> **Research Date:** 2026-02-12
> **Claude Code Version at time of research:** 2.1.39
> **Feature Status:** Experimental / Research Preview (disabled by default)
> **Released with:** Claude Opus 4.6 (announced February 5, 2026)

---

## Executive Summary

Agent teams are an experimental feature in Claude Code that lets you orchestrate multiple independent Claude Code sessions working in parallel as a coordinated team. One session acts as the "team lead" that spawns, coordinates, and manages "teammates" -- each running in its own context window with its own tools. Unlike subagents (which run within a single session and only report results back), teammates can communicate directly with each other via a shared mailbox system and coordinate through a shared task list. The feature was released as a research preview alongside Claude Opus 4.6 on February 5, 2026.

---

## Table of Contents

1. [What Are Agent Teams?](#1-what-are-agent-teams)
2. [How to Enable and Configure](#2-how-to-enable-and-configure)
3. [CLI Flags and Configuration Files](#3-cli-flags-and-configuration-files)
4. [Architecture and Communication](#4-architecture-and-communication)
5. [How to Start and Manage Teams](#5-how-to-start-and-manage-teams)
6. [Use Cases](#6-use-cases)
7. [Best Practices](#7-best-practices)
8. [Hooks for Agent Teams](#8-hooks-for-agent-teams)
9. [Comparison: Agent Teams vs Subagents](#9-comparison-agent-teams-vs-subagents)
10. [Limitations](#10-limitations)
11. [Token Usage and Cost](#11-token-usage-and-cost)
12. [Official Documentation and Sources](#12-official-documentation-and-sources)

---

## 1. What Are Agent Teams?

Agent teams let you coordinate multiple Claude Code instances working together as a team. The core components are:

| Component      | Description |
|:---------------|:------------|
| **Team Lead**  | The main Claude Code session that creates the team, spawns teammates, and coordinates work. The lead is fixed for the team's lifetime and cannot be transferred. |
| **Teammates**  | Separate, independent Claude Code instances, each with its own context window. They work on assigned tasks and can communicate directly with each other. |
| **Task List**  | A shared list of work items with dependency tracking. Teammates can self-claim tasks or be assigned by the lead. Tasks have three states: pending, in-progress, and completed. |
| **Mailbox**    | A messaging system for inter-agent communication. Messages are delivered automatically. Supports direct messages and broadcasts. |

Each teammate is a full Claude Code session -- it loads the same project context as a regular session (CLAUDE.md, MCP servers, skills) but does **not** inherit the lead's conversation history.

### Key differentiator from subagents

Unlike subagents (which run within a single session and can only report back to the parent agent), agent team teammates:
- Can message each other directly (peer-to-peer)
- Share a task list for self-coordination
- Users can interact with individual teammates directly
- Each teammate is fully independent with its own context window

---

## 2. How to Enable and Configure

### Enable Agent Teams

Agent teams are disabled by default. Enable by setting the `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` environment variable to `1`:

**Option A -- Environment variable:**
```bash
export CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1
```

**Option B -- settings.json:**
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

This can go in any of the standard settings file locations:
- `~/.claude/settings.json` (user-global)
- `.claude/settings.json` (project-level, committable)
- `.claude/settings.local.json` (project-level, gitignored)
- Managed policy settings (enterprise/organization-wide)

### Configure Display Mode (Teammate Mode)

Agent teams support three display modes via the `teammateMode` setting:

| Mode           | Description | Requirements |
|:---------------|:------------|:-------------|
| `"auto"` (default) | Uses split panes if running inside tmux; otherwise in-process | None |
| `"in-process"` | All teammates run inside your main terminal. Use Shift+Up/Down to select teammates. | Works in any terminal |
| `"tmux"`       | Each teammate gets its own split pane. See everyone's output simultaneously. | Requires tmux or iTerm2 with `it2` CLI |

**Set in settings.json:**
```json
{
  "teammateMode": "in-process"
}
```

**Override per-session via CLI flag:**
```bash
claude --teammate-mode in-process
```

### Split Pane Requirements

For `"tmux"` mode:
- **tmux**: Install via system package manager (see [tmux wiki](https://github.com/tmux/tmux/wiki/Installing))
- **iTerm2**: Install the [`it2` CLI](https://github.com/mkusaka/it2), then enable Python API in iTerm2 > Settings > General > Magic > Enable Python API
- Note: `tmux -CC` in iTerm2 is the suggested entrypoint for tmux on macOS
- Split panes are **not supported** in: VS Code integrated terminal, Windows Terminal, or Ghostty

---

## 3. CLI Flags and Configuration Files

### CLI Flags

| Flag | Description |
|:-----|:------------|
| `--teammate-mode <mode>` | Override teammate display mode for this session. Values: `in-process`, `tmux`, `auto` |

### Environment Variables (Set Automatically for Teammates)

When a teammate is spawned, these environment variables are automatically set:

| Variable | Description |
|:---------|:------------|
| `CLAUDE_CODE_TEAM_NAME` | Name of the team |
| `CLAUDE_CODE_AGENT_ID` | Unique agent ID (e.g., `worker-1@my-project`) |
| `CLAUDE_CODE_AGENT_NAME` | Agent display name |
| `CLAUDE_CODE_AGENT_TYPE` | Agent type (e.g., `Explore`, `Plan`, `general-purpose`) |
| `CLAUDE_CODE_AGENT_COLOR` | Display color for the agent |
| `CLAUDE_CODE_PLAN_MODE_REQUIRED` | Whether plan approval is required before implementation |
| `CLAUDE_CODE_PARENT_SESSION_ID` | Session ID of the parent/lead |

### Configuration Variables for Enabling

| Variable | Description |
|:---------|:------------|
| `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | Set to `1` to enable agent teams |
| `CLAUDE_CODE_SPAWN_BACKEND` | Force spawn backend: `in-process`, `tmux` |

### Settings.json Fields

| Field | Type | Description |
|:------|:-----|:------------|
| `env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` | string | `"1"` to enable agent teams |
| `teammateMode` | string | Display mode: `"auto"`, `"in-process"`, `"tmux"` |

### File System Storage

Teams and tasks are stored locally:

```
~/.claude/teams/{team-name}/
  config.json          # Team metadata: name, description, lead, members array
  inboxes/{agent}.json # Message inbox for each agent

~/.claude/tasks/{team-name}/
  1.json               # Individual task files
  2.json
  3.json
```

**Team config structure:**
```json
{
  "name": "my-project",
  "description": "Working on feature X",
  "leadAgentId": "team-lead@my-project",
  "createdAt": 1706000000000,
  "members": [
    {
      "agentId": "worker-1@my-project",
      "name": "worker-1",
      "agentType": "general-purpose",
      "color": "#4A90D9",
      "model": "sonnet",
      "prompt": "...",
      "planModeRequired": false,
      "backendType": "in-process",
      "tmuxPaneId": null
    }
  ]
}
```

**Task file structure:**
```json
{
  "id": "1",
  "subject": "Review authentication module",
  "description": "...",
  "status": "in_progress",
  "owner": "security-reviewer",
  "activeForm": "Reviewing auth module...",
  "blockedBy": [],
  "blocks": ["3"],
  "createdAt": 1706000000000,
  "updatedAt": 1706000001000
}
```

---

## 4. Architecture and Communication

### Seven Core Primitives (Internal Tools)

The agent team system is built on seven internal tools:

1. **TeamCreate** -- Initializes a team namespace and creates the configuration file
2. **TaskCreate** -- Defines discrete work units as JSON files on disk
3. **TaskUpdate** -- Allows agents to claim tasks and update status
4. **TaskList** -- Returns available work for self-claiming teammates
5. **Task (with team_name)** -- Spawns a teammate as a full Claude Code session
6. **SendMessage** -- Enables direct peer-to-peer communication between any teammates
7. **TeamDelete** -- Cleans up team files after completion

### Communication Patterns

**Message Types:**

| Type | Purpose | Sender |
|:-----|:--------|:-------|
| `message` | Direct peer-to-peer communication | Any teammate |
| `broadcast` | Send to all teammates simultaneously | Typically lead |
| `shutdown_request` | Initiate exit process | Lead |
| `shutdown_approved` | Confirm termination | Teammate |
| `shutdown_response` | Response to shutdown request | Teammate |
| `idle_notification` | Report going idle | Teammate |
| `task_completed` | Notify of task completion | Teammate |
| `plan_approval_request` | Request strategy review before implementing | Teammate |
| `plan_approval_response` | Approve/reject a plan | Lead |
| `join_request` | Request team membership | Potential member |
| `permission_request` | Request tool authorization | Teammate |

**How teammates share information:**
- **Automatic message delivery**: Messages delivered automatically to recipients. The lead does not need to poll.
- **Idle notifications**: When a teammate finishes and stops, it automatically notifies the lead.
- **Shared task list**: All agents can see task status and claim available work.
- **File locking**: Task claiming uses file locking to prevent race conditions when multiple teammates try to claim the same task simultaneously.

### Spawn Backends

Three backends auto-detect based on environment:

| Backend | Detection | Visibility | Persistence |
|:--------|:----------|:-----------|:------------|
| **in-process** | Default (no tmux) | Hidden; switch with Shift+Up/Down | Dies with leader |
| **tmux** | `$TMUX` set or tmux available | Visible panes | Survives exit |
| **iterm2** | `$TERM_PROGRAM="iTerm.app"` | Split panes | Dies with window |

### Permissions

- Teammates start with the lead's permission settings
- If the lead runs with `--dangerously-skip-permissions`, all teammates do too
- After spawning, individual teammate modes can be changed
- Per-teammate permission modes cannot be set at spawn time

### Context Loading

Teammates load the same project context as a regular session:
- CLAUDE.md files from their working directory
- MCP servers
- Skills
- The spawn prompt from the lead

The lead's conversation history does **not** carry over.

---

## 5. How to Start and Manage Teams

### Starting a Team

**Two ways to start:**

1. **You request a team**: Describe the task and team structure in natural language.
2. **Claude proposes a team**: If Claude determines your task would benefit from parallel work, it may suggest creating a team. You confirm before it proceeds.

Claude will never create a team without your approval.

**Example prompt:**
```
I'm designing a CLI tool that helps developers track TODO comments across
their codebase. Create an agent team to explore this from different angles: one
teammate on UX, one on technical architecture, one playing devil's advocate.
```

### Keyboard Controls

| Control | Function |
|:--------|:---------|
| `Shift+Up/Down` | Select/cycle through teammates (in-process mode) |
| `Enter` | View selected teammate's session |
| `Escape` | Interrupt a teammate's current turn |
| `Ctrl+T` | Toggle the task list |
| `Shift+Tab` | Cycle into delegate mode (lead coordination only) |

### Specifying Teammates and Models

```
Create a team with 4 teammates to refactor these modules in parallel.
Use Sonnet for each teammate.
```

### Plan Approval Mode

Require teammates to plan before implementing, for complex or risky tasks:

```
Spawn an architect teammate to refactor the authentication module.
Require plan approval before they make any changes.
```

When a teammate finishes planning:
1. It sends a plan approval request to the lead
2. The lead reviews and either approves or rejects with feedback
3. If rejected, the teammate stays in plan mode, revises, and resubmits
4. Once approved, the teammate exits plan mode and begins implementation

The lead makes approval decisions autonomously. Influence its judgment with criteria in your prompt (e.g., "only approve plans that include test coverage").

### Delegate Mode

Prevents the lead from implementing tasks itself. Restricts the lead to coordination-only tools: spawning, messaging, shutting down teammates, and managing tasks.

Enable by pressing `Shift+Tab` after starting a team.

### Talking to Teammates Directly

- **In-process mode**: Shift+Up/Down to select, then type to message directly
- **Split-pane mode**: Click into a teammate's pane to interact directly

### Assigning and Claiming Tasks

- **Lead assigns**: Tell the lead which task to give to which teammate
- **Self-claim**: After finishing a task, teammates pick up the next unassigned, unblocked task

Task dependencies: A pending task with unresolved dependencies cannot be claimed until dependencies are completed. When a dependency completes, blocked tasks automatically unblock.

### Shutting Down Teammates

```
Ask the researcher teammate to shut down
```

The lead sends a shutdown request. The teammate can approve (exit gracefully) or reject with an explanation.

### Cleaning Up the Team

```
Clean up the team
```

- Checks for active teammates and fails if any are still running (shut them down first)
- Removes shared team resources
- **Always use the lead** to clean up -- teammates should not run cleanup because their team context may not resolve correctly

---

## 6. Use Cases

### Strongest Use Cases

1. **Research and Review**: Multiple teammates investigate different aspects of a problem simultaneously, then share and challenge each other's findings.

2. **New Modules or Features**: Teammates each own a separate piece without stepping on each other (e.g., frontend, backend, tests).

3. **Debugging with Competing Hypotheses**: Teammates test different theories in parallel. The adversarial debate structure fights anchoring bias -- the theory that survives challenge is more likely the actual root cause.

4. **Cross-Layer Coordination**: Changes that span frontend, backend, and tests, each owned by a different teammate.

5. **Parallel Code Review**: Assign security, performance, and test coverage to separate reviewers for thorough attention in each domain simultaneously.

### Detailed Examples

**Parallel Code Review:**
```
Create an agent team to review PR #142. Spawn three reviewers:
- One focused on security implications
- One checking performance impact
- One validating test coverage
Have them each review and report findings.
```

**Competing Hypotheses Debugging:**
```
Users report the app exits after one message instead of staying connected.
Spawn 5 agent teammates to investigate different hypotheses. Have them talk to
each other to try to disprove each other's theories, like a scientific
debate. Update the findings doc with whatever consensus emerges.
```

**QA Swarm (from community example):**
Five agents testing: core page responses, blog post rendering, navigation integrity, SEO metadata/RSS validity, accessibility/HTML structure -- running in parallel against a website.

### When NOT to Use Agent Teams

- Sequential tasks with many dependencies
- Same-file edits (leads to overwrites/conflicts)
- Routine, simple tasks (coordination overhead exceeds benefit)
- Cost-sensitive work (significantly higher token usage)

---

## 7. Best Practices

1. **Give teammates enough context**: Include task-specific details in spawn prompts, since they don't inherit the lead's conversation history.

2. **Size tasks appropriately**: 5-6 tasks per teammate is the sweet spot. Too small = overhead exceeds benefit. Too large = risk of wasted effort.

3. **Avoid file conflicts**: Break work so each teammate owns different files. Two teammates editing the same file leads to overwrites.

4. **Wait for teammates to finish**: If the lead starts implementing instead of waiting, tell it: "Wait for your teammates to complete their tasks before proceeding."

5. **Start with research and review**: If new to agent teams, begin with non-code tasks (reviewing PRs, researching libraries, investigating bugs) to see the value of parallel exploration without coordination challenges.

6. **Monitor and steer**: Check in on progress, redirect approaches that aren't working, and synthesize findings as they come in.

7. **Use delegate mode**: For complex orchestration, press Shift+Tab to restrict the lead to coordination-only tools.

8. **Use plan approval for risky work**: Require teammates to submit plans before implementation.

9. **Pre-approve common operations**: Configure permission settings before spawning teammates to reduce interruptions from permission prompts bubbling up to the lead.

10. **Use meaningful agent names**: `security-reviewer` is better than `worker-1` for clarity.

---

## 8. Hooks for Agent Teams

Two hooks are specifically designed for agent teams:

### TeammateIdle

- **When it fires**: When an agent team teammate is about to go idle after finishing its turn
- **Purpose**: Enforce quality gates before a teammate stops working
- **Blocking behavior**: Exit with code 2 to send feedback (via stderr) and keep the teammate working
- **Matcher support**: None (fires on every occurrence)
- **Does NOT support**: Prompt-based or agent-based hooks

**Input fields (in addition to common fields):**

| Field | Description |
|:------|:------------|
| `teammate_name` | Name of the teammate about to go idle |
| `team_name` | Name of the team |

**Example -- require build artifact before going idle:**
```bash
#!/bin/bash
if [ ! -f "./dist/output.js" ]; then
  echo "Build artifact missing. Run the build before stopping." >&2
  exit 2
fi
exit 0
```

### TaskCompleted

- **When it fires**: When a task is being marked as completed (either explicitly via TaskUpdate, or when a teammate finishes its turn with in-progress tasks)
- **Purpose**: Enforce completion criteria (passing tests, lint checks, etc.) before a task can close
- **Blocking behavior**: Exit with code 2 to prevent completion and feed stderr as feedback
- **Matcher support**: None (fires on every occurrence)

**Input fields (in addition to common fields):**

| Field | Description |
|:------|:------------|
| `task_id` | Identifier of the task being completed |
| `task_subject` | Title of the task |
| `task_description` | Detailed description (may be absent) |
| `teammate_name` | Name of the teammate completing (may be absent) |
| `team_name` | Name of the team (may be absent) |

**Example -- require tests to pass before task completion:**
```bash
#!/bin/bash
INPUT=$(cat)
TASK_SUBJECT=$(echo "$INPUT" | jq -r '.task_subject')

if ! npm test 2>&1; then
  echo "Tests not passing. Fix failing tests before completing: $TASK_SUBJECT" >&2
  exit 2
fi
exit 0
```

**Hook configuration in settings.json:**
```json
{
  "hooks": {
    "TeammateIdle": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/check-idle.sh"
          }
        ]
      }
    ],
    "TaskCompleted": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/check-completion.sh"
          }
        ]
      }
    ]
  }
}
```

---

## 9. Comparison: Agent Teams vs Subagents

| Aspect | Subagents | Agent Teams |
|:-------|:----------|:------------|
| **Context** | Own context window; results return to caller | Own context window; fully independent |
| **Communication** | Report results back to main agent only | Teammates message each other directly |
| **Coordination** | Main agent manages all work | Shared task list with self-coordination |
| **User interaction** | Cannot interact with subagents directly | Can message any teammate directly |
| **Best for** | Focused tasks where only the result matters | Complex work requiring discussion and collaboration |
| **Token cost** | Lower: results summarized back to main context | Higher: each teammate is a separate Claude instance |
| **Session resumption** | N/A (ephemeral) | Not supported for in-process teammates |
| **Spawning nested workers** | Can spawn further subagents | Cannot spawn their own teams |

**Rule of thumb**: Use subagents when you need quick, focused workers that report back. Use agent teams when teammates need to share findings, challenge each other, and coordinate on their own.

**Token cost comparison (approximate from community benchmarks):**
- Solo session: ~200k tokens
- Three subagents: ~440k tokens
- Three-person team: ~800k tokens

---

## 10. Limitations

Current experimental limitations:

1. **No session resumption with in-process teammates**: `/resume` and `/rewind` do not restore in-process teammates. After resuming, the lead may try to message non-existent teammates.

2. **Task status can lag**: Teammates sometimes fail to mark tasks as completed, blocking dependent tasks.

3. **Shutdown can be slow**: Teammates finish their current request/tool call before shutting down.

4. **One team per session**: A lead can only manage one team at a time. Clean up the current team before starting a new one.

5. **No nested teams**: Teammates cannot spawn their own teams or teammates. Only the lead manages the team.

6. **Lead is fixed**: The session that creates the team is the lead for its lifetime. Cannot promote a teammate or transfer leadership.

7. **Permissions set at spawn**: All teammates start with the lead's permission mode. Can change individual modes after spawning, but cannot set per-teammate modes at spawn time.

8. **Split panes require tmux or iTerm2**: Not supported in VS Code integrated terminal, Windows Terminal, or Ghostty.

9. **CLAUDE.md works normally**: Teammates read CLAUDE.md files from their working directory (this is a feature, not a limitation -- use it to provide project-specific guidance to all teammates).

---

## 11. Token Usage and Cost

Agent teams use significantly more tokens than a single session. Each teammate has its own context window, and token usage scales with the number of active teammates.

From various sources:
- Agent teams are approximately **7x the tokens** of a standard session when teammates run in plan mode (per VentureBeat)
- Token usage explains approximately **80% of performance variance** (from Anthropic's multi-agent research)
- Approximate cost ratios: solo ~200k, 3 subagents ~440k, 3-person team ~800k tokens (from community benchmarks)

**When the extra tokens are worth it**: Research, review, new feature work, cross-layer coordination, debugging with competing hypotheses.

**When to stick with a single session**: Routine tasks, sequential work, same-file edits, cost-sensitive work.

---

## 12. Official Documentation and Sources

### Primary / Official Sources

1. **Official Documentation -- Agent Teams**
   - URL: https://code.claude.com/docs/en/agent-teams
   - Status: Official Anthropic documentation
   - Content: Complete reference for agent teams feature

2. **Official Documentation -- Hooks Reference (TeammateIdle, TaskCompleted)**
   - URL: https://code.claude.com/docs/en/hooks
   - Status: Official Anthropic documentation
   - Content: Full hooks reference including agent team hooks

3. **Anthropic Claude Code Release Notes**
   - URL: https://docs.anthropic.com/en/release-notes/claude-code
   - Status: Official release notes / changelog

4. **Claude Code v2.1.33 Release (agent teams hooks added)**
   - URL: https://github.com/anthropics/claude-code/releases/tag/v2.1.33
   - Content: Added TeammateIdle and TaskCompleted hooks, tmux fixes, agent memory support

5. **Anthropic Docs -- Subagents (for comparison)**
   - URL: https://docs.anthropic.com/en/docs/claude-code/sub-agents
   - Content: Subagent documentation for comparison with agent teams

6. **Anthropic Docs -- Team Identity and Access Management**
   - URL: https://docs.anthropic.com/en/docs/claude-code/team
   - Content: Team billing and access management (different from agent teams)

### Announcements and Press

7. **TechCrunch: "Anthropic releases Opus 4.6 with new 'agent teams'"**
   - URL: https://techcrunch.com/2026/02/05/anthropic-releases-opus-4-6-with-new-agent-teams/
   - Date: February 5, 2026
   - Content: Product announcement including quotes from Scott White, Head of Product

8. **VentureBeat: "Anthropic's Claude Opus 4.6 brings 1M token context and 'agent teams'"**
   - URL: https://venturebeat.com/technology/anthropics-claude-opus-4-6-brings-1m-token-context-and-agent-teams-to-take
   - Content: Feature overview and token cost discussion

### Community / Third-Party Analysis

9. **Addy Osmani: "Claude Code Swarms"**
   - URL: https://addyosmani.com/blog/claude-code-agent-teams/
   - Content: Comprehensive overview, architecture, best practices, compound engineering plugin

10. **alexop.dev: "From Tasks to Swarms: Agent Teams in Claude Code"**
    - URL: https://alexop.dev/posts/from-tasks-to-swarms-agent-teams-in-claude-code/
    - Content: Technical architecture (seven primitives), real-world QA swarm example, cost trade-offs

11. **Kieran Klaassen: Claude Code Swarm Orchestration Skill (GitHub Gist)**
    - URL: https://gist.github.com/kieranklaassen/4f2aba89594a4aea4ad64d753984b2ea
    - Content: Complete technical specification including all TeammateTool operations, environment variables, message types, orchestration patterns

12. **SitePoint: "Claude Code Agent Teams: Run Parallel AI Agents on Your Codebase"**
    - URL: https://www.sitepoint.com/anthropic-claude-code-agent-teams/
    - Content: Setup guide

13. **claudefast.com: "Claude Code Agent Teams: Multi-Session Orchestration"**
    - URL: https://claudefa.st/blog/guide/agents/agent-teams
    - Content: Multi-session orchestration guide

14. **Geeky Gadgets: "Claude Code Agent Teams Workflows for Large Projects"**
    - URL: https://www.geeky-gadgets.com/claude-code-agent-team-guide/
    - Content: Workflows for large projects

15. **Scott Spence: "Enable Team Mode in Claude Code"**
    - URL: https://scottspence.com/posts/enable-team-mode-in-claude-code
    - Content: Enablement guide

### Known Issues (GitHub)

16. **Teammate mode fails with tmux pane-base-index non-zero**
    - URL: https://github.com/anthropics/claude-code/issues/23527

17. **teammateMode "tmux" -- split panes open but teammates disconnected from messaging**
    - URL: https://github.com/anthropics/claude-code/issues/24771

18. **teammateMode "tmux" does not create iTerm2 split panes despite prerequisites met**
    - URL: https://github.com/anthropics/claude-code/issues/24292

---

## Research Limitations

1. **Rapidly evolving feature**: Agent teams are experimental and changing frequently. Details in this document may become outdated as new versions are released.
2. **Community benchmarks**: Token cost comparisons come from community testing, not official Anthropic benchmarks.
3. **Internal tool names**: The seven primitives (TeamCreate, TaskCreate, etc.) are described in community analysis and may not precisely match internal implementation names.
4. **Some sources overlap**: Multiple community articles reference the same official documentation, so findings are largely convergent.
