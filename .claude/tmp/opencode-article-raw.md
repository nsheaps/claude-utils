# Porting Claude Code's Agent Teams to OpenCode - Complete Article Extraction

**Source**: https://dev.to/uenyioha/porting-claude-codes-agent-teams-to-opencode-4hol
**Extracted**: 2026-02-16

---

## Introduction & Context

The article documents how the OpenCode team rebuilt Claude Code's agent teams system—a framework where lead AI agents spawn teammate agents that coordinate through message passing. This occurred in early February 2026, following Claude Code's initial release of the concept.

The key distinction: **"OpenCode runs all teammates in the same process, so we don't need files for cross-process IPC. But we still wanted a clean audit trail."**

## What is OpenCode

OpenCode is an open-source implementation available at **github.com/sst/opencode**. Unlike Claude Code (which supports three spawn backends: in-process, tmux split-pane, and iTerm2 split-pane), OpenCode operates as a single-process system with a critical capability: **"mix models from different providers in the same team."**

## Agent Teams Concepts Ported

**Core Structure**: A lead agent spawns teammate agents, each with its own context window, coordinating through message passing.

**Tested Scenarios**:
1. **NFL Research**: Two Gemini agents researching team history
2. **Super Bowl Prediction**: Four Claude Opus agents (stats analyst, betting analyst, matchup analyst, injury scout)
3. **Architecture Drama**: GPT-5.3 Codex, Gemini 2.5 Pro, and Claude Sonnet 4 in one team

## Portable vs Claude-Specific Elements

### Claude Code Architecture (Portable)
- Fire-and-forget spawning model
- Explicit sub-agent isolation
- File-based inbox persistence
- Built-in task management
- Plan approval mechanisms
- Delegate mode for permission restriction

### OpenCode Innovations (Non-Portable to Claude Code)
- Event-driven messaging versus polling
- Append-only JSONL writes versus O(N) JSON array rewrites
- Peer-to-peer communication (full mesh topology)
- Multi-model provider support
- Two-level state machines
- Atomic task claiming under concurrent access
- Ordered bootstrap recovery sequence

## Architecture Decisions & Rationale

### Messaging Layer: Two-Component Design

**Component 1 - Inbox (Source of Truth)**: 

> "Every message first gets appended to the recipient's inbox—a per-agent JSONL file at `team_inbox/<projectId>/<teamName>/<agentName>.jsonl`. Each line is a JSON object with an `id`, `from`, `text`, `timestamp`, and a `read` flag."

**Component 2 - Session Injection (Delivery Mechanism)**: 

> "Then the message gets injected into the recipient's session as a synthetic user message, so the LLM actually sees it. Finally, `autoWake` restarts the recipient's prompt loop if they're idle."

**Performance Rationale**: 

Claude Code's approach requires **"read the whole file, deserialize, push one entry, serialize, write it all back—O(N) per message."** 

OpenCode's JSONL model achieves **"O(1) writes"** with file rewriting only during `markRead` operations, which **"fires once per prompt loop completion, not per message."**

### The Spawn Problem Resolution

**First Attempt (Failed)**: Non-blocking spawn caused the lead's prompt loop to exit after the LLM received success confirmation, leaving teammates orphaned.

**Second Attempt (Failed)**: Blocking spawn prevented parallel teammate coordination since **"The lead can't coordinate multiple teammates in parallel if it's stuck waiting for the first one to finish."**

**Solution**: Fire-and-forget spawn paired with auto-wake. 

> "The spawn stays fire-and-forget, but when a teammate sends a message to an idle lead, the system restarts the lead's prompt loop automatically." 

This required three commits to finalize: **"The insight wasn't about blocking semantics—it was that the messaging layer needed to be able to restart idle sessions."**

### Peer-to-Peer Communication Design

Rather than routing through the leader, teammates can directly message each other by name. Testing demonstrated tangible benefits: 

> "a betting analyst proactively broadcast findings to all teammates, and an injury scout cross-referenced that data without the lead having to relay it. The lead focused on orchestration instead of being a message router."

System prompt instruction: **"You can message any teammate by name—not just the lead."**

### Sub-Agent Isolation: Dual Enforcement

Sub-agents spawned via the `task` tool for codebase exploration cannot access team messaging, preventing **"high-volume output—grep results, file reads, intermediate reasoning"** from flooding the coordination channel.

**Enforcement Layer 1 - Permission Deny Rules**:
```typescript
const TEAM_TOOLS = [
  "team_create", "team_spawn", "team_message", "team_broadcast",
  "team_tasks", "team_claim", "team_approve_plan",
  "team_shutdown", "team_cleanup",
] as const

...TEAM_TOOLS.map(t => ({
  permission: t, pattern: "*", action: "deny",
}))
```

**Enforcement Layer 2 - Visibility Hiding**:
```typescript
tools: {
  ...Object.fromEntries(TEAM_TOOLS.map(t => [t, false])),
}
```

This dual approach emerged after **"a security audit (commit `2ad270dc4`) found that sub-agents could accidentally access `team_message` through inherited parent permissions."**

### State Machine Architecture: Two-Level System

**Member Status (Coarse-Grained)**:
- Five states: ready, busy, shutdown_requested, shutdown, error
- Governs recovery and cleanup logic
- Simplified reasoning for state machine complexity

**Execution Status (Fine-Grained)**:
- Ten states tracking exact prompt loop position
- Enables UI to display real-time teammate activities
- Prevents overloading UI with simplified coarse states

Rationale: 

> "The UI needs to show what each teammate is doing at any moment (the execution status), but recovery and cleanup logic needs a simpler model to reason about (the member status). Collapsing these into one state machine would have made either the UI too coarse or the recovery logic too complex."

Transition Validation includes escape hatches:
- `guard: true` prevents duplicate shutdown transitions during cleanup race conditions
- `force: true` bypasses validation during crash recovery when state machine consistency is compromised

## Complete Code Examples

### Simplified Send Flow
```typescript
// messaging.ts — simplified send flow
async function send(input) {
  // 1. Write to inbox (source of truth)
  await Inbox.write(input.teamName, input.to, {
    id: messageId(),
    from: input.from,
    text: input.text,
    timestamp: Date.now(),
  })

  // 2. Inject into session (delivery mechanism)
  await injectMessage(targetSessionID, input.from, input.text)

  // 3. Wake idle recipients
  autoWake(targetSessionID, input.from)
}
```

### Fire-and-Forget Spawn with Error Handling
```typescript
Promise.resolve()
  .then(async () => {
    await transitionExecutionStatus(teamName, name, "running")
    return SessionPrompt.loop({ sessionID: session.id })
  })
  .then(async (result) => {
    await notifyLead(teamName, name, session.id, result.reason)
  })
  .catch(async (err) => {
    await transitionMemberStatus(teamName, name, "error")
  })

return { sessionID: session.id, label } // returns immediately
```

### Member Status Transitions
```typescript
const MEMBER_TRANSITIONS: Record<MemberStatus, MemberStatus[]> = {
  ready:              ["busy", "shutdown_requested", "shutdown", "error"],
  busy:               ["ready", "shutdown_requested", "error"],
  shutdown_requested: ["shutdown", "ready", "error"],
  shutdown:           [],          // terminal
  error:              ["ready", "shutdown_requested", "shutdown"],
}
```

### Graceful Cancellation with Retry
```typescript
for (const _ of [0, 1, 2]) {
  SessionPrompt.cancel(member.sessionID)
  await transitionExecutionStatus(teamName, memberName, "cancelling")
  await Bun.sleep(120)
  if (TERMINAL_EXECUTION_STATES.has(current?.execution_status)) break
}
```

## Implementation Details

### Message Delivery Comparison
The article presents a comparison matrix:

| Dimension | Polling | Event-driven/auto-wake |
|-----------|---------|------------------------|
| **Inbox files** | Claude Code | **OpenCode** |
| **Session injection only** | (nobody does this) | (original design) |

**Write Path Efficiency**:
- Claude Code: O(N) per message
- OpenCode: O(1) writes via append, O(N) only on `markRead` batching

**Delivery Receipts Pattern**: 

When messages are marked read, `markRead` batches them by sender and fires **"delivery receipts back as regular team messages, the same pattern as actor model replies and XMPP read receipts."**

### Recovery Sequence on Server Restart

**Step 1 - Permission Handler Registration**: 

> "This must be ready before recovery because recovery could trigger cleanup, which might need to restore delegate-mode permissions on the lead session."

**Step 2 - State Transition**: 

> "scan all teams for busy members and force-transition them to ready. Inject a notification into the lead"

**Step 3 - Event Subscription**: 

> "subscribe to auto-cleanup events *after* recovery finishes. If you subscribe before, the status transitions that recovery itself triggers would cause spurious cleanup."

**Key Decision**: 

> "no automatic restart. Interrupted teammates get marked as ready but their prompt loops don't restart. The user has to re-engage them. This prevents runaway agents after a crash. You lose convenience, but you don't wake up to find four agents have been burning API credits all night on a stale task."

System message on recovery:
```
[System]: Server was restarted. The following teammates in team "X"
were interrupted and need to be resumed: worker-1, worker-2.
Use team_message or team_broadcast to tell them to continue their work.
```

## Limitations & Lessons Learned

### Delivery Receipts (Best-Effort)

> "If the process crashes after `markRead()` but before the receipt is injected into the sender's session, the sender never learns the recipient read their message. The read state itself survives—it's the notification that's lost. This is the same trade-off XMPP and Matrix make."

Claude Code makes different tradeoff: **"`markMessagesAsRead` flips a local flag with no sender notification."**

### No Backpressure

> "A fast sender can flood a slow receiver. There's a 10KB per-message limit but no bounded queue."

### Single-Process Constraint

> "All locks are in-memory, so you can't run multiple server instances against the same storage. Claude Code's file-based locking works across processes—that's one advantage of their approach."

### No Cross-Team Communication

> "Teams are isolated. No inter-team messaging primitive."

### Manual Recovery

> "After a crash, teammates are ready but idle. The human re-engages them. This is intentional, but it means unattended teams can't self-heal."

### Real-World Complications

Testing revealed model-specific issues: 

> "the model generated ~50 near-identical 'task complete' messages in a loop, unable to stop. No unit test catches that." 

This emerged only during NFL Research scenario testing.

## Comprehensive Comparison Table

| Dimension | Claude Code | OpenCode |
|-----------|-------------|----------|
| Message storage | JSON array (O(N) read-modify-write per message) | JSONL append-only (O(1) writes) + session injection |
| Message notification | Polling | Event-driven auto-wake |
| Spawn model | Fire-and-forget (3 backends) | Fire-and-forget (in-process only) |
| Communication | Leader-centric | Full mesh (peer-to-peer) |
| Tool model | 8+ dedicated tools | 9 dedicated tools |
| State tracking | Implicit | Two-level state machine (member + execution) |
| Task management | Built-in | Built-in with dependencies + atomic claiming |
| Sub-agent isolation | Explicit | Explicit (deny list + visibility hiding) |
| Recovery | Not publicly documented | Ordered bootstrap with manual restart |
| Multi-model | Single provider | Multi-provider per team |
| Message tracking | Read/unread flag (local only, no sender notification) | Read/unread + delivery receipts to sender (reply messages) |
| Locking | File locks | In-memory RW lock (writer priority) |
| Plan approval | Present | First-class with tagged permission pattern |
| Delegate mode | Present | Lead restricted to coordination-only tools |

## Conclusion

> "The systems are more similar than different. Both use fire-and-forget spawning, file-based inbox persistence, and explicit sub-agent isolation. The real divergences—event-driven messaging, append-only JSONL writes, peer-to-peer communication, multi-model support, two-level state machines—come from OpenCode's constraint of running everything in a single process and its goal of supporting multiple providers."

The implementation spans three production PRs on the dev branch: #12730 (core), #12731 (tools & routes), and #12732 (TUI).

---

## Key Architectural Insights Summary

### 1. The Spawn Problem
- **Challenge**: Balancing fire-and-forget spawning with lead agent availability for coordination
- **Solution**: Auto-wake mechanism that restarts idle sessions when messages arrive
- **Lesson**: The critical insight was about messaging layer capabilities, not spawn semantics

### 2. Message Persistence Strategy
- **Claude Code**: JSON array requiring O(N) read-modify-write per message
- **OpenCode**: JSONL append-only for O(1) writes, with batched markRead for efficiency
- **Trade-off**: Best-effort delivery receipts vs guaranteed local read state

### 3. Communication Topology
- **Claude Code**: Leader-centric (all messages route through lead)
- **OpenCode**: Full mesh peer-to-peer (teammates can directly message each other)
- **Benefit**: Lead focuses on orchestration, not being a message router

### 4. Sub-Agent Isolation
- **Dual enforcement**: Permission deny rules + visibility hiding
- **Rationale**: Prevent coordination channel flooding with high-volume exploration output
- **Discovery**: Security audit found permission inheritance issues requiring both layers

### 5. State Machine Design
- **Member Status**: 5 coarse states for recovery/cleanup logic
- **Execution Status**: 10 fine states for UI display
- **Rationale**: Separation prevents either UI being too coarse or recovery logic too complex
- **Escape hatches**: `guard: true` and `force: true` for edge cases

### 6. Recovery Philosophy
- **No automatic restart**: Prevents runaway agents burning credits on stale tasks
- **Manual re-engagement**: User must explicitly resume interrupted teammates
- **Ordered bootstrap**: Permission handlers → state transition → event subscription

### 7. Multi-Model Support
- **Unique to OpenCode**: Mix models from different providers in same team
- **Example**: GPT-5.3 Codex + Gemini 2.5 Pro + Claude Sonnet 4 working together
- **Challenge**: Model-specific behaviors (e.g., message loops) emerge only in integration testing

## References
- OpenCode repository: github.com/sst/opencode
- Implementation PRs: #12730 (core), #12731 (tools & routes), #12732 (TUI)
- Article author: uenyioha
- Publication: dev.to
