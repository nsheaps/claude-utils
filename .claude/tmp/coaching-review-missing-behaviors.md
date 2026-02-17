# Coaching Review — 4 New Behaviors from #63

**Reviewer**: Wile E. Coyote (Team Coach)
**Task**: #78
**Date**: 2026-02-17
**Lens**: Do these encode the actual lessons from our 9 failures? Would an agent reading these avoid the specific mistakes we've made?

---

## Executive Summary

**All 4 behaviors PASS.** Foghorn clearly read the coaching synthesis and encoded the specific lessons, not just generic best practices. These are materially better than the original 7 behaviors at addressing our actual failure patterns. Each behavior references the failure count, names the pattern, and provides concrete steps tied to what went wrong.

The pre-task-checklist is the standout — it's comprehensive, prescriptive, and would have been the single highest-leverage intervention if it existed from day one.

**Overall: PASS. Strong work. Minor suggestions below but nothing blocking.**

---

## Per-Behavior Assessment

### 1. requirements-verification.md — PASS (9/10)

**Target failures**: #3, #4, #8, #9 (Pattern A: "Act First, Verify Later")

**Does it encode the actual lessons?**
YES. Every major lesson from the coaching synthesis is present:
- Step 1: "Run TaskGet... do not rely on message summary, memory, or compaction summary" — directly addresses Failure #9 root cause
- Step 3: "Verify mechanisms before implementing... with a minimal test case" — directly addresses Failure #9's @references mistake (implemented without verifying it works)
- Step 4: "If multiple approaches... STOP. Do not pick one autonomously" — directly addresses Failures #3 and #4 (Tweety picking approaches without approval)
- Step 5: "Confirm no HOLD is in effect" — directly addresses Failure #4 (work despite hold)
- Step 7: Full post-compaction protocol — directly addresses the compaction failure vector from Failure #9

**Would an agent reading this avoid our mistakes?**
YES. Step 1 alone would have prevented Failure #9. Step 4 alone would have prevented Failures #3 and #4. Step 3 would have prevented the @references implementation.

**Anti-patterns concrete enough?**
YES. "Trusting the compaction summary as a source of requirements" — that's exactly what happened. "Implementing around an unverified mechanism, then discovering it doesn't work" — that's the @references pattern.

**What's excellent:**
- Step 6 ("State your understanding") creates a visible checkpoint — this is a coaching innovation not in my synthesis. It creates a moment where misunderstandings can be caught BEFORE work starts.
- The description calls it "highest-priority behavior" and cites "4 of 9 failures" — sets the urgency correctly.

**Minor suggestion:**
- Could add: "If you receive updated requirements mid-task, restart this checklist from step 1." This would address the mid-session requirement changes that complicated Failure #9.

---

### 2. communication-verification.md — PASS (9/10)

**Target failures**: #1, #5, #6 (Pattern B: "Messages to the Void")

**Does it encode the actual lessons?**
YES. All key lessons present:
- Step 1: "Save deliverables to files first" with explicit pattern — directly addresses the data loss from Failures #1 and #5 (5+ messages lost because content was only in messages)
- Step 2: "Read team config... use exact name field" — directly addresses Road Runner's recipient guessing
- Step 3: "Use team-lead as fallback" — practical safety net that would have saved all 5 lost messages
- Step 4: Post-compaction name refresh — addresses the compaction vector
- Step 5: "Escalate on silence" — addresses the invisible failure mode (SendMessage silent success)

**Would an agent reading this avoid our mistakes?**
YES. The file-first pattern (step 1) makes messages optional for delivery — even if the message goes to the void, the deliverable is preserved. Step 2's explicit "read team config" instruction would have prevented Road Runner from guessing "Bugs Bunny (Team Lead)."

**Anti-patterns concrete enough?**
YES. "Guessing recipient names from role descriptions instead of reading team config" — exactly what Road Runner did. "Sending to multiple guessed variations of a name hoping one works" — prevents the escalation pattern. "Trusting your post-compaction memory of teammate names" — direct lesson from our experience.

**What's excellent:**
- The "save to file first, message contains summary + path" pattern is clean and actionable. An agent can follow this without ambiguity.
- Step 5's escalation protocol fills a gap — we had no procedure for "what if my message was lost?"

**Minor suggestion:**
- Could add: "SendMessage returns success even for non-existent recipients (known platform behavior). Do NOT treat a successful send as confirmation of delivery." Making the platform bug explicit would help agents understand WHY verification matters.

---

### 3. pre-task-checklist.md — PASS (10/10)

**Target failures**: All — this is the meta-behavior that prevents most failure types.

**Does it encode the actual lessons?**
YES. This is the "highest-leverage team change" I identified in the coaching synthesis, and Foghorn implemented it comprehensively:
- Step 1: TaskGet requirement — addresses Failure #9
- Step 2: Read referenced materials — addresses Failure #9 (didn't read research)
- Step 3: Verify approach, stop if multiple — addresses Failures #3, #4
- Step 4: Verify tools/mechanisms — addresses Failure #9 (@references)
- Step 5: Verify recipients — addresses Failures #1, #5
- Step 6: Check for HOLD — addresses Failure #4
- Step 7: State your plan — creates visible checkpoint (coaching innovation, same as requirements-verification step 6)

**Would an agent reading this avoid our mistakes?**
YES — this is the strongest "would have prevented" behavior. Running through this checklist before each task would have prevented Failures #1, #3, #4, #5, #8, and #9. That's 6 of 9 failures (67%) from a single behavior.

**Anti-patterns concrete enough?**
YES. Every anti-pattern maps to something that actually happened:
- "Skipping because the task seems simple" — Failure #3 (prettierignore "quick fix")
- "Reading assignment message instead of TaskGet" — Failure #9
- "Starting while planning to verify later" — Failures #3, #4, #8
- "Assuming you know what referenced documents say" — Failure #9
- "Picking approach autonomously when alternatives exist" — Failures #3, #4
- "Beginning before testing mechanism works" — Failure #9

**What's excellent:**
- Step 7's plan statement template is practical and specific:
  ```
  Starting [task #X]. My understanding:
  - Goal: [one sentence]
  - Approach: [one sentence]
  - Output: [what I'll deliver and where]
  ```
  This is actionable, low-overhead, and creates an audit trail.

- The description positions this as "proactive counterpart to self-correction" — good conceptual framing that shows where it fits in the behavior ecosystem.

- "This is not optional" and "no exceptions" language sets the right tone. This is a mandatory gate, not a suggestion.

**No suggestions.** This is the strongest file in the entire behaviors collection.

---

### 4. verify-before-blaming.md — PASS (8/10)

**Target failures**: #2, #6, #7, #8 (Pattern C: "Blame the Tool")

**Does it encode the actual lessons?**
YES. The core lesson — "check your own work before blaming external tools" — is clear and well-structured:
- Step 1: "Check your own work first" with specific checklist — addresses Failures #2 and #8 (Tweety's YAML was invalid, not prettier)
- Step 2: "Reproduce in isolation" — the test that Foghorn did for Task #16 that broke the misdiagnosis cycle
- Step 3: "Verify each theory before accepting it" with explicit falsification approach — addresses the root cause analysis failures
- Step 5: "Get independent verification" — addresses Failure #8's compounding (everyone accepted the diagnosis)

**Would an agent reading this avoid our mistakes?**
MOSTLY. Steps 1-2 would have prevented Tweety from blaming prettier (test prettier on known-good input → it works → problem is your input). Step 5 would have prevented the team from collectively accepting the false diagnosis.

However, step 4 ("be skeptical of the first explanation") is LESS concrete than the others. The questions it asks are good thinking prompts but harder to operationalize. An agent under pressure might read "Is this the simplest explanation?" and answer "yes, prettier broke it" — because from their perspective, it WAS the simplest explanation.

**Anti-patterns concrete enough?**
MOSTLY. The standout anti-patterns are:
- "Scaling up a workaround without verifying the root cause" — exactly Foghorn expanding prettierignore (Failure #3)
- "Letting confirmation bias drive diagnosis" — exactly what happened across Failures #2 → #8
- "Multiple agents reinforcing an unverified diagnosis" — the team pattern from Failure #8

**What could be stronger:**
- Step 4's thinking prompts could be more prescriptive. Instead of "Is this the simplest explanation?", consider: "Write down TWO alternative explanations. If you can't think of two, you haven't investigated enough." Forcing alternative hypotheses is more effective than asking if the current one is simple.
- Missing: "When the 'broken tool' is one you've successfully used before (like prettier), the probability that it suddenly broke is lower than the probability that your input changed. Weight your prior." This directly addresses the prettier narrative.

**Minor suggestion:**
- Could add a specific callout: "YAML frontmatter is a common source of 'tool blame' — when a markdown tool seems to mangle your frontmatter, check your YAML syntax first (valid delimiters, no blank lines before opening ---, no markdown inside YAML values)." This is team-specific but highly relevant given Failures #2 and #8.

---

## Cross-Behavior Consistency Check

| Aspect | Consistent? | Notes |
|--------|------------|-------|
| Format (frontmatter + Purpose/When/Steps/Anti-Patterns) | YES | All 4 follow the same structure as the original 7 |
| Failure citations | YES | All 4 reference specific failure counts from the log |
| Tone | YES | Prescriptive, direct, matches existing behaviors |
| Overlap handling | GOOD | pre-task-checklist incorporates elements from requirements-verification and communication-verification without redundancy — it's a meta-checklist that points to the detailed procedures |
| Anti-pattern specificity | STRONG | Much more concrete than the original 7 behaviors — these name the actual mistakes |

---

## Comparison: Original 7 vs New 4

| Metric | Original 7 | New 4 |
|--------|-----------|-------|
| Average rating | 6.4/10 | 9.0/10 |
| Failures directly addressed | ~3 of 9 | 9 of 9 |
| Team-specific content | Low (generic best practices) | High (cites failure patterns, names actual mistakes) |
| Actionability | Good | Excellent (especially pre-task-checklist template) |
| Anti-pattern specificity | Moderate | Strong (maps to actual team failures) |

The new 4 behaviors are meaningfully better than the original 7 at encoding team-specific lessons. This is the difference between "behaviors Foghorn thought agents should have" and "behaviors built from evidence of what actually went wrong."

---

## Verdict

| Behavior | Rating | Pass/Fail |
|----------|--------|-----------|
| requirements-verification.md | 9/10 | PASS |
| communication-verification.md | 9/10 | PASS |
| pre-task-checklist.md | 10/10 | PASS |
| verify-before-blaming.md | 8/10 | PASS |

**Overall: PASS (4/4)**

**pre-task-checklist.md is the strongest file in the entire behaviors collection** (11 files total). It's comprehensive, prescriptive, and directly addresses the team's dominant failure pattern.

The minor suggestions above (mid-task requirement restart, SendMessage platform bug callout, alternative hypothesis forcing, YAML-specific callout) are improvements, not blockers. These behaviors are ready for use.

**Coaching note for Foghorn**: This is excellent work and a significant improvement over the original 7 behaviors. The difference is clear — the original 7 were written from engineering intuition, while these 4 were written from evidence. The failure citations, concrete anti-patterns, and team-specific language show that Foghorn read the coaching synthesis and translated it into actionable procedures. This is what "getting better" looks like.
