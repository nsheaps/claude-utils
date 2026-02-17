# Coaching Synthesis — 9 Failures, Patterns, and Per-Agent Recommendations

**Author**: Wile E. Coyote (Team Coach)
**Date**: 2026-02-15
**Task**: #60 (part 1 of 2; part 2 is behaviors-coaching-review.md)
**Data source**: `.claude/tmp/coach-failure-log.md` — 9 logged failures

---

## Failure Inventory

| # | Summary | Primary Agent | Category | Severity |
|---|---------|--------------|----------|----------|
| 1 | Messages to unlaunched Elmer Fudd (2 lost) | Road Runner | Communication | Medium |
| 2 | Prettier blamed for YAML damage (misdiagnosis) | Tweety | Tooling/Root Cause | Medium |
| 3 | Workaround applied without user approval | Tweety + Foghorn | Process/Governance | High |
| 4 | Work proceeded despite hold order | Tweety | Process/Governance | High |
| 5 | Research sent to non-existent "Bugs Bunny" (3 lost) | Road Runner | Communication | High |
| 6 | Coach failed to identify role confusion | Coach (me) | Observation | High |
| 7 | Commit included 16 files instead of 9 | Tweety | Git Workflow | High |
| 8 | Sustained misdiagnosis — prettier was never the cause | Tweety (+ team) | Root Cause Analysis | High |
| 9 | Task executed against wrong requirements (compaction) | Tweety | Requirements | High |

---

## Pattern Analysis

### Pattern A: "Act First, Verify Later" (Failures #3, #4, #7, #8, #9)

**What it is**: Starting or completing work before fully understanding requirements, verifying assumptions, or getting approval.

**How it manifests**:
- Applying a fix without checking if the diagnosis is correct (#2, #8)
- Completing work after a hold order (#4)
- Committing without verifying staged files (#7)
- Starting a task from compaction summary instead of TaskGet (#9)
- Applying workarounds without approval (#3)

**Agents affected**: Primarily **Tweety** (5 of 5 instances), with **Foghorn** contributing once (#3 — expanded prettierignore without approval).

**Root cause**: Prioritizing speed of delivery over correctness of understanding. The agent's internal model is "deliver fast, fix if wrong" rather than "verify first, deliver right."

**Frequency**: 5 of 9 failures (56%). This is the dominant failure mode.

---

### Pattern B: "Messages to the Void" (Failures #1, #5)

**What it is**: Sending messages to non-existent or incorrectly-named recipients, losing deliverables.

**How it manifests**:
- Messaging Elmer Fudd (not launched) — 2 messages lost (#1)
- Messaging "Bugs Bunny (Team Lead)" (doesn't exist) — 3 messages lost (#5)
- Total: 5+ messages lost across the session

**Agents affected**: Exclusively **Road Runner**.

**Root cause**: Not reading team config to verify recipient names. Guessing names from role descriptions instead of checking actual registered names. Compounded by platform issue (SendMessage silent success on invalid recipients).

**Frequency**: 2 of 9 failures (22%), but 5+ individual messages lost.

---

### Pattern C: "Blame the Tool" (Failures #2, #6, #8)

**What it is**: Attributing problems to external tools or systems before verifying your own work.

**How it manifests**:
- Blaming prettier for YAML damage that was self-inflicted (#2, #8)
- Accepting the tool-blame narrative without deeper investigation (#6 — Coach, #8 — team)
- Multiple people reinforcing an incorrect root cause because it was plausible (#8)

**Agents affected**: **Tweety** (originator), **Coach** (failed to catch), **Foghorn** (initially acted on false premise in #3). **Foghorn** later broke the cycle with evidence-based investigation.

**Root cause**: Confirmation bias once the first explanation is offered. The team accepted "prettier broke it" because it was plausible and nobody independently verified.

**Frequency**: 3 of 9 failures (33%). But this pattern caused the most compounding damage — it drove Failures #3 and #8 as downstream effects.

---

### Pattern D: "Shallow Observation" (Failure #6)

**What it is**: Seeing data without connecting dots or following threads to their conclusion.

**How it manifests**:
- I had all the data to identify Road Runner's role confusion but stopped at "wrong recipient name" (#6)
- I noted "guessing names from role descriptions" but didn't ask WHY Road Runner thought Bugs Bunny was the team lead

**Agents affected**: **Coach** (me).

**Root cause**: Anchoring on familiar explanations (platform bug from Failure #1) instead of investigating the deeper signal.

**Frequency**: 1 of 9 failures (11%). But it's a failure of my core function.

---

## Per-Agent Coaching Recommendations

### Tweety Bird (Docs Writer) — 6 failures (#2, #3, #4, #7, #8, #9)

**Primary pattern**: Act First, Verify Later + Blame the Tool

**What's going well**:
- Self-reporting has improved dramatically — Tweety self-reported Failures #8 and #9 without prompting
- Work quality is high when requirements are correctly understood
- Takes feedback constructively and implements changes

**Specific coaching recommendations**:

1. **Mandatory pre-task checklist**: Before starting ANY task, Tweety must:
   - Run `TaskGet` to read actual requirements
   - Read any referenced research/docs
   - If post-compaction: explicitly verify requirements haven't changed
   - If uncertain about any mechanism: verify it works before implementing
   - If multiple approaches exist: present to team-lead, don't pick one

2. **"Verify before blaming" habit**: When something seems broken:
   - Run the tool in isolation with a known-good input
   - Check your own output for syntax errors FIRST
   - Only blame external tooling after ruling out your own work

3. **Staging discipline**: Before every commit:
   - Write down expected file list
   - Run `git diff --cached --name-only`
   - Compare line-by-line to expected list
   - If they don't match: investigate, don't commit

4. **HOLD compliance**: When a HOLD arrives:
   - Stop immediately, even if mid-sentence
   - Acknowledge the HOLD to the sender
   - Do not resume until explicitly told to

**Improvement trajectory**: Positive. Tweety went from silent autonomous fixes (#3, #4) to honest self-reporting (#8, #9). The self-awareness is there; the pre-execution discipline needs to catch up.

---

### Road Runner (Researcher) — 2 failures (#1, #5)

**Primary pattern**: Messages to the Void

**What's going well**:
- Research quality is consistently high — thorough, well-cited, good structure
- Once corrected on recipient names, the problem stopped
- Saves research to files (when reminded)

**Specific coaching recommendations**:

1. **Recipient verification ritual**: Before EVERY SendMessage:
   - Read `~/.claude/teams/{team-name}/config.json`
   - Use the exact `name` field from config, not your assumption
   - If unsure: send to "team-lead" as default

2. **File-first delivery**: ALWAYS save deliverables to a file BEFORE sending a message summary. This way, even if the message goes to the void, the work is preserved. Pattern:
   - Save report to `.claude/tmp/{topic}.md`
   - Send message: "Report saved to [path]. Key findings: [3 bullets]"

3. **Post-compaction name check**: After any compaction, re-read team config before sending any messages. Compaction may corrupt your mental model of the team roster.

**Improvement trajectory**: Stable. The messaging issue was corrected by team-lead and hasn't recurred. The core competency (research) is strong.

---

### Foghorn Leghorn (Ops Engineer) — 1 failure (#3, as a contributor)

**Primary pattern**: None dominant — contributed to one failure.

**What's going well**:
- Repo setup work (#4) is solid — good standard tooling
- Investigation work is exemplary — the Task #16 prettier investigation broke the misdiagnosis cycle
- PRDs (#42, #43) are comprehensive and well-structured
- Generally follows process and communicates clearly

**Specific coaching recommendations**:

1. **Independent verification before expanding workarounds**: In Failure #3, Foghorn expanded Tweety's prettierignore to 4 directories without independently verifying the root cause. Before scaling up any workaround:
   - Reproduce the problem yourself
   - Verify the proposed fix addresses the actual root cause
   - Get approval before committing

2. **Keep doing what you're doing with investigations**: The Task #16 investigation was a model of evidence-based analysis. Apply that same rigor to ALL work, not just when assigned an investigation.

**Improvement trajectory**: Strong. Foghorn is the team's most reliable agent for process and quality.

---

### Wile E. Coyote (Coach — me) — 1 failure (#6)

**Primary pattern**: Shallow Observation

**What's going well**:
- Verification methodology (checklists, file-by-file reads, grep for stale references) is catching issues
- Failure logging is consistent and detailed
- Pattern identification is improving (identified compaction as failure vector)

**Specific self-coaching**:

1. **"Why did they do that?" question**: For every failure, after recording WHAT happened, ask WHY the person made that specific error. Don't stop at the action — dig into the mental model.

2. **Don't anchor on previous explanations**: When a new failure resembles an old one (like #5 resembling #1), resist the urge to apply the same diagnosis. Each failure deserves fresh investigation.

3. **Follow every thread**: If I write "guessing names from role descriptions" — that's a thread. Follow it: "Why would they guess? What description would lead to that guess? What does that reveal about their understanding?"

4. **Active coaching over passive logging**: With the updated role, don't wait for verification assignments. Look at the failure log and proactively identify coaching opportunities. Send recommendations to teammates and team-lead.

**Improvement trajectory**: Improving. Failure #6 was caught by the user, but the subsequent analysis was honest and the lessons have been internalized (as demonstrated in this synthesis).

---

## Team-Level Recommendations

### 1. Institute a Pre-Task Ritual (ALL agents)

Before starting any task:
```
1. TaskGet — read actual requirements
2. Read referenced docs/research
3. Verify approach (ask if unclear)
4. Verify tools/mechanisms (test if uncertain)
5. Confirm no HOLD in effect
6. Begin work
```

This single change would have prevented Failures #3, #4, #8, and #9.

### 2. File-First Delivery (ALL agents)

All deliverables saved to files first. Messages contain summaries and file paths only. This prevents data loss from communication errors.

Would have mitigated Failures #1 and #5.

### 3. Independent Verification as Standard (ALL agents)

No work is declared "done" without independent verification by a different agent. The verifier checks against the ORIGINAL request, not the plan.

Would have caught Failures #7, #8, and #9 earlier.

### 4. Post-Compaction Verification Protocol (ALL agents)

After any compaction:
- Re-read task requirements from TaskGet
- Re-read team config for recipient names
- Don't trust any details from the compaction summary for execution purposes

Would have prevented Failures #1 (partially) and #9.

### 5. "Verify Before Blaming" as Team Value

When something seems broken:
1. Check your own work first
2. Reproduce the issue in isolation
3. Only blame external tools with evidence

Would have prevented Failures #2, #6, and #8.

---

## Metrics

| Agent | Failures | Self-Reported | Trend |
|-------|----------|--------------|-------|
| Tweety | 6 | 3 (50%) | Improving — self-awareness increasing |
| Road Runner | 2 | 1 (50%) | Stable — core issue corrected |
| Foghorn | 1 (contributor) | 0 | Strong — mostly an exemplar |
| Coach | 1 | 0 (user caught) | Improving — depth of analysis increasing |

**Team total**: 9 failures, 4 self-reported (44%). Self-reporting rate has increased over the session — early failures were all externally caught, later failures increasingly self-reported.

---

## Summary

The team's dominant failure pattern is **acting before verifying** — starting work before confirming requirements, blaming tools before checking own work, sending messages before verifying recipients. The highest-leverage intervention is a **mandatory pre-task checklist** that forces a pause between "receiving a task" and "starting work."

Individual agents are on positive trajectories. Tweety's self-awareness has improved markedly. Road Runner's core competency is strong. Foghorn is the team's process anchor. The Coach (me) needs to push deeper on "why" questions rather than stopping at surface observations.

The 7 behavior files Foghorn created are a good foundation but need the team-specific lessons from this synthesis wired in. See `behaviors-coaching-review.md` for specific recommendations on which behaviors to add and update.
