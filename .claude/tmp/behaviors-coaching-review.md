# Behaviors Framework — Coaching Review

**Reviewer**: Wile E. Coyote (Team Coach)
**Task**: #56 (reviewing Foghorn's #50 deliverable)
**Date**: 2026-02-15
**Lens**: Self-improvement — will these behaviors actually make agents better?

---

## Executive Summary

The 7 behaviors are **well-structured, clearly written, and actionable**. Foghorn did solid work — the README establishes a clear conceptual distinction (behavior vs agent vs skill), and each behavior file follows a consistent format (purpose, when to use, steps, anti-patterns).

However, applying the coaching lens: **these behaviors codify what good agents already do. They don't address the specific failure patterns this team has demonstrated.** The behaviors read like generic engineering best practices, not lessons learned from our 9 logged failures. That's a missed opportunity.

**Overall: PASS on structure and quality. NEEDS WORK on team-specific relevance.**

---

## Per-Behavior Assessment

### 1. research.md — STRONG

**Will it make agents better?** Yes, particularly steps 2 (plan your search) and 6-7 (save to file, summarize to requester).

**Grounded in team experience?** Yes — directly addresses Road Runner's context-bloat issue (anti-pattern: "Fetching web pages directly in your own context") and the deliverable-as-message-only problem (Failures #1, #5 — messages lost to void because findings weren't saved to files).

**Gaps:**
- Missing: "Verify recipient exists before sending findings." This team has lost 5+ messages to non-existent recipients. The research behavior should include a step: "Before sending your summary, verify the recipient name by reading the team config."
- Missing: "State what you don't know." The anti-pattern mentions it ("I don't know is a valid finding") but the steps don't include a "document gaps" step. Step 5 has "Open questions" in the report structure, which partially covers this.

**Rating: 8/10** — Strongest behavior file. Directly addresses real team patterns.

---

### 2. self-correction.md — STRONG with one critical gap

**Will it make agents better?** Yes — the stop/reflect/identify/fix/verify loop is exactly what was missing in Failures #2-#4 and #8-#9 (Tweety proceeding without stopping to verify).

**Grounded in team experience?** Partially. The steps match what SHOULD have happened in Failure #8 (sustained prettier misdiagnosis) and Failure #9 (wrong requirements from compaction). But it doesn't address the specific failure vector we've seen most.

**Critical gap — Missing: "Verify your understanding of the task requirements BEFORE starting."** Self-correction is reactive — it kicks in after something goes wrong. But our biggest failure pattern is starting work with wrong requirements (Failure #9), wrong assumptions (Failure #8 prettier blame), or without approval (Failures #3, #4). We need a **pre-execution verification** step, not just a post-failure one.

The behavior says "Stop immediately" at step 1, but the agent has already done work by then. The highest-value intervention is BEFORE the work starts.

**Suggestion:** Add a step 0: "Before starting any task, verify: (a) you have the current requirements from TaskGet, (b) you understand the approach, (c) you have approval to proceed."

**Rating: 7/10** — Solid reactive procedure, but misses the proactive check that would prevent most failures.

---

### 3. verification.md — SOLID

**Will it make agents better?** Yes. Steps 1 and 5 ("Re-read the original request" and "Compare plan vs original request") directly address the plan-vs-request drift we saw in Failure #9.

**Grounded in team experience?** Yes — this is essentially the procedure I used for Tasks #25, #27, #36, and #49. The checklist approach (step 2) matches my verification methodology.

**Gaps:**
- Missing: "After compaction, re-read the original request from TaskGet, not from the compaction summary." This is a specific failure vector we documented (Failure #9). The behavior should call it out explicitly since compaction is a routine event that corrupts task understanding.
- Step 4 mentions `mise run fmt-check` and `mise run test` — good. But doesn't mention `git diff --name-only` against base branch, which is how we caught the scope creep in Failure #7 (16 files instead of 9).

**Rating: 7/10** — Good general procedure, could be stronger with team-specific lessons.

---

### 4. failure-reporting.md — ADEQUATE but incomplete

**Will it make agents better?** Partially. The reporting template and severity levels are useful. But this behavior describes HOW to report failures — it doesn't address the harder problem of RECOGNIZING failures.

**Grounded in team experience?** The "capture immediately" step addresses the delay pattern we saw with Tweety (reporting after the fact). The "also message team-lead" fallback is good.

**Critical gap — Missing: "Recognize that something IS a failure."** Our biggest coaching gap (Failure #6 — my own failure) was not recognizing what the data was telling me. Tweety's Failure #8 chain happened because nobody recognized the prettier misdiagnosis as a failure until Foghorn investigated. The behavior assumes you already know something went wrong. It should include recognition triggers:
- "If you blamed an external tool, verify your own work first"
- "If you applied a workaround, that's a failure to report even if the workaround worked"
- "If a teammate flags something, treat it as a potential failure even if you think you're right"

**Rating: 5/10** — Covers the mechanics of reporting but not the harder skill of recognizing what needs reporting.

---

### 5. commit-hygiene.md — SOLID

**Will it make agents better?** Yes. Steps 2 (group logically, avoid `git add .`) and 5 (verify the commit with `git show --stat HEAD`) directly address Failure #7 (16 files committed instead of 9).

**Grounded in team experience?** Yes — this reads like it was written with Failure #7 in mind. Good.

**Gaps:**
- Missing: "Compare `git diff --cached --name-only` to your expected file list BEFORE committing." Step 1 says review, but it doesn't make the pre-commit verification explicit enough. In Failure #7, Tweety claimed to have done this but the commit still had extra files. The behavior should be more prescriptive: "Write down the files you intend to commit. After staging, run git diff --cached --name-only and compare line by line."
- The anti-pattern about `--amend` is good but should also mention: "After a pre-commit hook failure, remember the commit did NOT happen — don't use --amend."

**Rating: 7/10** — Addresses the right problems, could be more prescriptive on the pre-commit check.

---

### 6. code-review.md — SOLID

**Will it make agents better?** Yes. The "re-read the original request" emphasis (step 1) and "check each change against the request" (step 3) are strong.

**Grounded in team experience?** Partially. The steps are good general practice but don't reference our specific patterns. The "check for unintended changes" step (6) is directly relevant to Failure #7.

**Gaps:**
- No mention of reviewing YAML frontmatter validity, which was a specific issue (Failure #2/8). For this team, "look for common issues" should include "YAML frontmatter: valid syntax, proper delimiters, no markdown inside YAML values."
- Step 5 mentions `mise run fmt-check` — good. But should also mention: "If the formatter changes files, understand WHY before assuming the formatter is wrong" (lesson from Failure #8).

**Rating: 6/10** — Good generic code review, but misses team-specific lessons about YAML and "verify before blaming tools."

---

### 7. documentation.md — ADEQUATE

**Will it make agents better?** Moderately. The "update docs in the same commit" principle (step 3) is valuable. The cross-reference check (step 5) addresses what we verified in Task #36 (role renames).

**Grounded in team experience?** Somewhat — the cross-reference step is relevant to our rename verifications. But documentation hasn't been a major failure area for this team. Our failures are in requirements understanding, tooling blame, and communication — not in doc drift.

**Gaps:**
- This is the LEAST team-relevant behavior. Our 9 failures include zero documentation-specific failures. This isn't wrong to have, but it's lower priority than behaviors we're actually failing at.
- Step 5 uses `grep -r` — should use built-in Grep tool per project conventions.

**Rating: 5/10** — Well-written but addresses a problem this team hasn't had. Lower priority.

---

## What's Missing — Behaviors We NEED

Based on 9 logged failures, here are the behaviors this team actually needs but doesn't have:

### 1. **requirements-verification** (HIGHEST PRIORITY)

**Pattern addressed**: Failures #3, #4, #8, #9 — Tweety's recurring pattern of starting work with wrong/stale/assumed requirements.

**Should include**:
- Before starting ANY task: run `TaskGet` and read the actual requirements
- After compaction: re-verify requirements from TaskGet, not compaction summary
- When requirements mention a mechanism (like @references): verify it works BEFORE implementing
- When uncertain: STOP and ask, don't proceed with a guess
- When multiple approaches exist: present options to team-lead, don't pick one autonomously

This is the single highest-value behavior we could add. 4 of our 9 failures trace to this pattern.

### 2. **communication-verification** (HIGH PRIORITY)

**Pattern addressed**: Failures #1, #5, #6 — Road Runner's repeated messaging to non-existent recipients.

**Should include**:
- Before sending to ANY recipient: read team config to verify the name
- ALWAYS save deliverables to files first, then send a summary message with the file path
- After compaction: re-verify teammate names from team config
- If a message seems important and you get no response: escalate to team-lead

3 of our 9 failures trace to this pattern.

### 3. **pre-task-checklist** (HIGH PRIORITY)

**Pattern addressed**: Multiple failures — the proactive check that prevents most reactive failures.

**Should include**:
- Read the task requirements (TaskGet)
- Read any referenced research/docs before starting
- Verify you have the right approach (if multiple approaches exist, ask)
- Verify you have the right tools (if uncertain about a mechanism, verify)
- Confirm no HOLD order is in effect
- Only then begin work

This is the "step 0" that self-correction.md is missing.

### 4. **verify-before-blaming** (MEDIUM PRIORITY)

**Pattern addressed**: Failures #2, #6, #7, #8 — blaming external tools without verifying own work.

**Should include**:
- When something fails: check your own work FIRST
- When an external tool seems broken: verify with a minimal test case
- When diagnosing root cause: verify each theory before accepting it
- Don't accept the first explanation — especially if it blames something external

4 of our 9 failures involved accepting incorrect root cause diagnoses.

---

## Team-Level Observations

### Pattern: Speed vs Correctness

The dominant failure pattern across this team is **prioritizing delivery speed over correctness of understanding**. This manifests as:
- Starting before reading requirements (Tweety, Failures #3, #4, #9)
- Sending before verifying recipients (Road Runner, Failures #1, #5)
- Blaming before checking own work (Tweety, Failures #2, #8; Coach, Failure #6)

The existing behaviors address the "how to do X correctly" but don't address the "slow down and verify BEFORE doing X" meta-behavior. The missing **pre-task-checklist** behavior would be the single highest-impact addition.

### Pattern: Compaction as Failure Vector

Failures #1 and #9 both involve post-compaction confusion — wrong recipient names, wrong task requirements. The behaviors should explicitly call out compaction as a moment requiring extra verification. A single line in each behavior: "After compaction, re-verify X from the authoritative source" would help.

### What's Working

- **Self-reporting**: Tweety self-reported Failures #8 and #9 without prompting. This is improvement.
- **Evidence-based investigation**: Foghorn's investigation that debunked the prettier narrative (leading to Failure #8 resolution) was excellent.
- **Research quality**: Road Runner's research outputs are thorough (just lost to wrong recipients).
- **Verification methodology**: The checklist approach used by Coach has caught every issue.

---

## Recommendations

1. **Add requirements-verification.md** — Highest priority. Addresses 4/9 failures.
2. **Add communication-verification.md** — High priority. Addresses 3/9 failures.
3. **Add pre-task-checklist.md** — High priority. Proactive prevention for most failure types.
4. **Add verify-before-blaming.md** — Medium priority. Addresses 4/9 failures.
5. **Update self-correction.md** — Add "step 0" pre-execution verification.
6. **Update failure-reporting.md** — Add failure recognition triggers.
7. **Add compaction notes** to verification.md and research.md — explicit "after compaction, re-verify from authoritative source" guidance.

---

## Verdict

| Aspect | Rating |
|--------|--------|
| Structure & format | PASS — consistent, clear, well-organized |
| Actionability | PASS — each behavior has concrete steps |
| Completeness (generic) | PASS — covers major engineering behaviors |
| Completeness (team-specific) | NEEDS WORK — doesn't address dominant failure patterns |
| Will it make agents better? | PARTIALLY — good hygiene, but misses the proactive checks that would prevent our most common failures |

**Bottom line**: Foghorn delivered a solid framework. The structure is right, the format is right, and the existing behaviors are well-written. But the framework is generic when it should be team-specific. The 4 missing behaviors (requirements-verification, communication-verification, pre-task-checklist, verify-before-blaming) would address 9/9 of our logged failures. The existing 7 behaviors address ~3/9.

That's the gap between "good engineering practices" and "getting better as a team."
