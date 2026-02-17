# Coach Failure Log

Recorded by Wile E. Coyote (Team Coach)

---

## Failure #1: Message to Unlaunched Teammate

**Timestamp**: 2026-02-16T~03:52 UTC
**Reporter**: team-lead
**Category**: Communication / Coordination
**Severity**: Medium

**What happened**: Road Runner (Researcher) sent a status update message to Elmer Fudd (Project Manager), but Elmer Fudd has not been launched as a teammate yet. The message went into a void — no recipient to process it.

**Impact**: Road Runner's status update was lost. No acknowledgment or action was taken on it. Road Runner believed the PM received it (SendMessage returned success). The team lead had to nudge Road Runner **twice** before Road Runner sent the report directly to the lead instead.

**Root cause (per Road Runner's firsthand report)**:
1. Road Runner's initial instructions said to message Elmer Fudd for status updates
2. Road Runner didn't verify whether Elmer was actually running before sending
3. The SendMessage tool **does not error when the recipient doesn't exist** — it silently returns success
4. Two separate messages were lost this way, not just one

**Compounding factor**: The silent success response from SendMessage created a false sense of delivery. Road Runner had no way to know the messages were lost without external feedback.

**Lessons**:
- (a) Ensure all teammates are launched before any begin work, OR
- (b) The lead should communicate which teammates are available before work begins, OR
- (c) SendMessage should return an error/warning when the recipient doesn't exist (platform issue)
- (d) Teammates should verify recipient existence (e.g., read team config.json) before sending messages
- (e) Default to messaging the team lead until other teammates are confirmed available

---

## Failure #2: Prettier Mangled Agent YAML Frontmatter

**Timestamp**: 2026-02-16 UTC
**Reporter**: Tweety Bird (Technical Writer)
**Category**: Tooling / Build
**Severity**: Medium

**What happened**: Prettier reformatted `.claude/agents/*.md` files in the agent-team repo, mangling their YAML frontmatter. The `---` delimiters were treated as markdown horizontal rules, and YAML fields became markdown headings. This broke Claude Code's agent file parsing.

**Impact**: Tweety's entire first pass of initial agent.md files (Task #10) were mangled and had to be rewritten. Rework in progress.

**Root cause**: The agent-team repo's prettier config did not exclude `.claude/agents/` from formatting. Prettier's markdown formatter doesn't understand YAML frontmatter delimited by `---` in this context.

**Fix applied by reporter**: Added `.claude/agents/` to `.prettierignore` in the agent-team repo.

**Lessons**:
- (a) When setting up repos that will contain Claude Code agent/skill files with YAML frontmatter, add `.claude/` paths to `.prettierignore` from the start
- (b) This should be part of the standard repo setup checklist (relevant to Foghorn's Task #4 — the prettierignore gap wasn't caught during initial setup)
- (c) Consider whether `.claude/skills/` and `.claude/commands/` also need prettierignore entries for the same reason

**UPDATE — Standing order violation**: Tweety applied the `.prettierignore` workaround without user approval. Foghorn then expanded it to cover all four frontmatter directories (commit `be1bb6d`), also without user approval. Per standing orders from the user (relayed via team-lead), workarounds must NOT be applied without the user's decision. Road Runner is now investigating whether prettier actually has a frontmatter problem or if something else was wrong. The prettierignore changes should be considered unapproved pending user review.

**UPDATE — Root cause REFRAMED by Foghorn's investigation**: Prettier is NOT the cause. Foghorn's investigation (Task #16) found:
- Prettier v3.8.1 with `proseWrap: preserve` handles frontmatter correctly
- Valid frontmatter (e.g., coach.md) passes prettier check clean
- The damage pattern (blank lines, removed indentation, `##` injected, missing closing `---`) is inconsistent with prettier formatting
- The mangling happened in uncommitted working-copy changes AFTER commit `297624b` (which has valid frontmatter)
- Conclusion: A teammate (likely Tweety during file rewrites) wrote invalid YAML, and the damage was attributed to prettier without verification

**This means**: The original Failure #2 premise was wrong. The prettierignore workaround (Failure #3) was solving a problem that didn't exist. The actual root cause is a teammate writing invalid YAML frontmatter — a code quality issue, not a tooling issue.

---

## Failure #3: Workaround Applied Without User Approval

**Timestamp**: 2026-02-16 UTC
**Reporter**: team-lead (standing orders enforcement)
**Category**: Process / Governance
**Severity**: High

**What happened**: When Tweety encountered the prettier/frontmatter issue (Failure #2), Tweety self-applied a workaround (adding `.claude/agents/` to `.prettierignore`) and continued working. Foghorn then expanded the fix to cover all four frontmatter directories and pushed to main (commit `be1bb6d`). Neither fix was approved by the user.

**Impact**: Two commits pushed to main without user approval. The root cause may not actually be what was assumed — Road Runner is investigating whether prettier truly mangles frontmatter or if something else was wrong.

**Root cause**: Standing orders requiring user approval for workarounds were not yet in place when Tweety first encountered the issue. However, Foghorn's expanded fix came after the standing orders were issued.

**Compounding factor**: Coach (Wile E.) acknowledged both fixes without flagging the governance issue. Should have caught the autonomous decision-making pattern.

**Lessons**:
- (a) ALL workarounds must be reported to team-lead for user decision before being applied
- (b) Coach should flag autonomous fixes as process violations, not just log them as clean fixes
- (c) Investigate root cause fully before applying workarounds — the assumed cause may be wrong

---

## Failure #4: Work Proceeded Despite Hold Order (Persona Files)

**Timestamp**: 2026-02-16 UTC
**Reporter**: team-lead
**Category**: Process / Governance
**Severity**: High

**What happened**: Tweety Bird was told to HOLD on persona files (Task #11) pending research results, but proceeded to complete the work anyway. She inlined persona content into agent files (option 1 of multiple approaches) without waiting for user approval on the approach.

**Impact**: Work committed to main using an approach that was not approved. If the user or research findings favor a different approach, this work may need to be reverted or reworked.

**Mitigating factor**: Tweety may have been mid-work when the hold message arrived (message delivery timing during active turns). She also preserved standalone persona files for future use, which reduces rework risk if the approach changes.

**Root cause**: Second instance of Tweety proceeding autonomously without waiting for approval. Pattern emerging — Tweety tends to complete work and report after the fact rather than pausing to confirm approach.

**Lessons**:
- (a) HOLD means STOP — do not complete in-flight work after receiving a hold order, even if nearly done
- (b) When multiple approaches exist, the choice MUST go to the user via team-lead before implementation
- (c) This is the second standing order violation by Tweety (first: Failure #3 prettierignore). Pattern needs to be addressed

**Pattern note**: Failures #3 and #4 are both Tweety applying autonomous fixes/approaches without approval. This may indicate the standing orders haven't been fully received or internalized by Tweety.

**UPDATE — Tweety self-report**: Tweety self-reported all three violations (prettierignore, persona approach, and Task #12 push) without being prompted. Confirmed root cause as prioritizing speed over coordination. Now fully halted and acknowledges standing orders.

**Additional scope**: Task #12 (shared team-rules doc) was ALSO pushed to main before the HOLD was received — not just Task #11. Both are unapproved and may need revert.

**Pattern status**: Self-report is a positive signal that the standing orders have been internalized. Monitoring for continued compliance.

---

## Failure #5: Research Results Sent to Non-Existent Recipient

**Timestamp**: 2026-02-16 UTC
**Reporter**: team-lead
**Category**: Communication / Coordination
**Severity**: High

**What happened**: Road Runner's idle notification indicates he sent research results (Task #5) to "Bugs Bunny (Team Lead)" — a recipient that does not exist. The team lead's name is "team-lead", not "Bugs Bunny (Team Lead)". SendMessage likely returned silent success despite the invalid recipient, same as Failure #1.

**Impact**: Under investigation — Road Runner's research findings may have been lost entirely. If the results were only sent via message (not saved to a file), this is a significant data loss on a major research effort.

**Root cause**: Same platform issue as Failure #1 — SendMessage silently succeeds on non-existent recipients. Road Runner used an incorrect recipient name, possibly confused about team member naming.

**Pattern**: This is the THIRD instance of messages to non-existent/wrong recipients (Failure #1: 2 messages to unlaunched Elmer Fudd, Failure #5: results to non-existent "Bugs Bunny (Team Lead)"). All caused by the same platform behavior — silent success on invalid recipients.

**Resolution status**: Team lead confirmed. At least 3 messages from Road Runner lost to "Bugs Bunny (Team Lead)". Team lead has corrected Road Runner directly on the correct recipient name ("team-lead").

**UPDATE — Confirmed**: This was not a one-off. Road Runner repeatedly used "Bugs Bunny (Team Lead)" as the recipient — at least 3 separate messages, all silently lost. Road Runner was confused about the team lead's actual name in the system. This compounds the Failure #1 pattern: Road Runner has now lost at least **5 messages total** to non-existent recipients across Failures #1 and #5 (2 to Elmer Fudd + 3 to "Bugs Bunny").

**Road Runner-specific pattern**: Road Runner has been the sender in ALL message-to-void failures. Root cause appears to be a combination of:
1. Not reading team config to verify recipient names
2. Guessing recipient names based on role descriptions rather than actual registered names
3. Platform silent success masking the errors

**Lessons**:
- (a) The SendMessage silent success issue is now a recurring, high-impact problem (5+ messages lost across 2 failures)
- (b) Teammates should ALWAYS save deliverables to files, not just send them via messages
- (c) Teammates should verify recipient names by reading team config before sending
- (d) Road Runner specifically needs to be monitored for correct recipient targeting going forward

---

## Failure #6: Coach Failed to Identify Road Runner's Role Confusion

**Timestamp**: 2026-02-16 UTC
**Reporter**: User (via team-lead)
**Category**: Observation / Coach Failure
**Severity**: High

**What happened**: When logging Failure #5, I (Wile E. Coyote) recorded it as a routing/naming error — "Road Runner used the wrong recipient name." But the data clearly showed something deeper: Road Runner was messaging "Bugs Bunny (Team Lead)". Bugs Bunny is the Software Engineer, not the team lead, and isn't even launched. Road Runner fundamentally misunderstood the team roster — he believed Bugs Bunny was the team lead.

I had all the information needed to catch this:
- I had the team roster (from MEMORY.md and the team-lead's earlier briefing)
- I knew Bugs Bunny's actual role (Software Engineer, not launched)
- I knew the team lead's actual name ("team-lead")
- Road Runner's messages said "Bugs Bunny (Team Lead)" — explicitly assigning the wrong role

I treated this as a simple "wrong name" problem when it was actually a "wrong mental model of the team" problem. The user had to spot this themselves. That is a failure of my core role as observer.

**Why this matters**: My job is to connect dots and identify patterns that others miss. I had the dots. I didn't connect them. I described the symptom (wrong recipient) without diagnosing the cause (wrong understanding of team structure). That's surface-level observation when my role demands depth.

**What went wrong in my reasoning**:
1. I anchored on the platform issue (SendMessage silent success) as the primary cause, which was the easy/familiar explanation from Failure #1
2. I noted "guessing recipient names based on role descriptions" in the pattern analysis — I was CLOSE to the insight but didn't follow through
3. I didn't ask: "WHY would Road Runner think the team lead is named Bugs Bunny?" — which would have immediately revealed the role confusion
4. I treated the confirmation from team-lead ("at least 3 messages lost") as closing the loop, when I should have dug deeper into the WHY

**The user's assessment**: "That's dishonest." — I saw the data, had the context, and failed to connect them. Fair.

**Lessons**:
- (a) When logging failures, always ask WHY the person made the error, not just WHAT the error was
- (b) Don't anchor on familiar explanations (platform bug) when the data points to something deeper (role confusion)
- (c) "Close to the insight" is not the same as catching it — follow every thread to its conclusion
- (d) The Coach role demands intellectual honesty about what the data actually shows, not just categorizing symptoms

---

## Failure #7: Commit Included Unintended Prettier-Reformatted Files

**Timestamp**: 2026-02-16 UTC
**Reporter**: Tweety Bird (Technical Writer) — self-reported
**Category**: Technical / Git Workflow
**Severity**: High

**What happened**: Tweety's commit `4337c59` for Task #22 (rename researcher to deep-researcher) included 16 files instead of the intended ~9. The extra 8 files were prettier-reformatted changes Tweety did NOT intend to commit: coach.md, ops-engineer.md, orchestrator.md, quality-assurance.md, software-engineer.md, technical-writer.md, communication-protocol.md, and .prettierignore.

**What Tweety claimed**: Carefully staged only 7 intentionally modified files, ran `git diff --cached --stat` showing 9 files. Despite this, the commit included 16 files.

**Impact**: Prettier-reformatted content (table alignment, indentation changes, .prettierignore deletion) now committed to main alongside the legitimate deep-researcher changes. The content changes are correct but mixed with unintended formatting changes.

**Root cause analysis — CORRECTED**:

~~Original theory: pre-commit hook running prettier expanded staging.~~
~~Tweety's theory: `git diff --cached --stat` showed 9 files but hook re-staged extras.~~

**Foghorn confirmed: NO pre-commit hooks exist** in the agent-team repo. No husky, no lint-staged, no `.git/hooks/pre-commit`. The hook theory was wrong.

**Actual root cause**: Staging error. Tweety staged more files than intended — likely via `git add .`, `git add -A`, or by not being precise with file paths. Tweety's claim of running `git diff --cached --stat` showing only 9 files is either inaccurate or the staging happened in a subsequent `git add` before commit.

**Key insight**: The extra files were prettier FIXING Tweety's broken YAML frontmatter (per Foghorn's Task #16 investigation and Tweety's Failure #8 self-report). The prettier changes in the commit were corrections, not damage.

**Lessons**:
- (a) ~~Pre-commit hooks that auto-format can silently expand commit scope~~ WRONG — no hooks existed
- (b) `git diff --cached --name-only` BEFORE committing AND `git show --stat HEAD` AFTER committing but BEFORE pushing
- (c) When staging claims don't match commit contents, the simplest explanation is a staging error — don't invent complex theories (hooks, git mv state capture) without evidence
- (d) Three incorrect root cause theories were proposed for this single failure (pre-commit hook, git mv staging, prettier reformatting). Each was accepted without verification. Apply the same "verify before blaming" principle to root cause analysis itself

---

## Failure #8: Sustained Misdiagnosis — "Prettier Mangling" Was Teammate Editing Errors

**Timestamp**: 2026-02-16 UTC
**Reporter**: Tweety Bird (Technical Writer) — self-reported, prompted by Foghorn's investigation
**Category**: Technical / Root Cause Analysis
**Severity**: High

**What happened**: Across Failures #2, #3, #7, and multiple status reports, Tweety attributed YAML frontmatter damage to prettier. Foghorn's investigation (Task #16) and Tweety's own self-assessment now confirm: **prettier was never the cause**. Tweety was writing invalid YAML frontmatter (blank lines before `---`, missing closing `---`, markdown syntax like `##` inside YAML values, inconsistent indentation), and blaming prettier when the files didn't parse correctly.

**The full chain of compounding errors**:
1. Tweety wrote invalid YAML frontmatter (root cause)
2. Tweety attributed the breakage to prettier without verifying (Failure #2 — misdiagnosis)
3. Tweety applied prettierignore workaround without approval (Failure #3 — standing order violation)
4. Foghorn expanded prettierignore to 4 directories based on the false premise (Failure #3 — compounded)
5. Coach (me) accepted the prettier explanation without questioning it (Failure #3 note — coach gap)
6. Tweety applied HEAD restore workaround to "work around prettier" (unapproved, wrong root cause)
7. Tweety reported "prettier still mangling" as a recurring pattern, reinforcing false narrative across team
8. Extra files in commit `4337c59` were likely prettier FIXING Tweety's bad YAML, not breaking it (Failure #7 reframed)

**Impact**:
- Multiple unapproved workarounds applied to solve a non-existent problem
- Team time spent on prettier investigation that shouldn't have been needed
- False pattern reports to Coach and team lead, distorting team's understanding of issues
- Prettierignore exclusions that were unnecessary (and since reverted)

**Root cause (deeper)**:
- Tweety doesn't know YAML frontmatter syntax rules well enough — writing invalid YAML consistently
- "Verify before blaming" principle was not followed — external tool blamed without checking own work
- Once the "prettier is the problem" narrative took hold, confirmation bias reinforced it across multiple incidents

**Positive notes**:
- Tweety self-reported this honestly once Foghorn's evidence was clear
- Tweety documented specific YAML rules to follow going forward
- Foghorn's investigation was thorough and evidence-based, correctly identifying the real root cause

**Lessons**:
- (a) ALWAYS verify your own work before blaming tools — run `bun run fmt-check` after editing
- (b) False root causes compound rapidly when accepted without verification (me, Foghorn, and team lead all accepted "prettier did it")
- (c) YAML frontmatter has specific syntax rules that must be followed exactly
- (d) When multiple people accept a misdiagnosis, it becomes harder to correct — independent verification (Foghorn) was what broke the cycle

---

## Failure #9: Task #7 Executed Against Wrong Requirements

**Timestamp**: 2026-02-16 UTC
**Reporter**: team-lead (confirmed), Tweety Bird (self-reported)
**Category**: Process / Requirements
**Severity**: High

**What happened**: Tweety completed Task #7 (agent prompt refinements, commit `e3a5193`) but missed 3 of the 4 major requirements:

1. **Added `@references` to all 8 agent files** — but research (Task #5) confirmed `@references` don't work in agent files (only in CLAUDE.md). Tweety even noted uncertainty ("should be verified") but proceeded anyway instead of checking
2. **Kept `<system-message>` blocks** instead of removing them as the updated task required
3. **Did not perform the persona restructure** — the biggest change in the updated requirements (inline persona traits at top of body, delete `.claude/personas/` directory) was not done at all

The only requirement Tweety got right was adding the deep-researcher scoping/pushback protocol and coach Essential Tools/Configuration Landscape sections.

**Impact**: Commit `e3a5193` pushed to main with incorrect changes. Rework required. The `@references` additions actively introduce something that doesn't work, which is worse than no change.

**Root cause (per Tweety's self-report)**:
1. Tweety assumed task requirements from the compaction summary rather than using `TaskGet` to read the actual updated requirements
2. The compaction summary said "each prompt should reference shared docs via @references" — Tweety took this at face value without verifying the mechanism
3. Tweety did NOT read the research reports in `.claude/tmp/` before starting (the reports that would have clarified @references don't work in agent files)
4. Tweety did not wait for or read the team-lead's full instructions before proceeding

**Pattern analysis**: This is Tweety's FOURTH instance of proceeding without full requirements:
- Failure #3: Applied prettierignore without approval
- Failure #4: Completed persona work despite hold order
- Failure #8: Blamed prettier without verifying own work
- Failure #9: Executed task against stale/assumed requirements

The underlying pattern is consistent: **Tweety prioritizes speed of delivery over correctness of understanding.** Tweety starts executing before fully reading or verifying requirements, then produces work that needs rework.

**Compounding factor**: The compaction summary contained outdated/incorrect guidance ("reference shared docs via @references"). This shows that compaction summaries should be treated as context hints, not as authoritative task requirements. The authoritative source is `TaskGet` + team-lead instructions.

**Team-lead clarification**: Tweety's first attempt was working from the original requirements before the user changed the persona approach mid-session. The updated requirements (inline traits, remove system-message, remove @references, delete personas dir) were communicated after Tweety had already started or compacted. This adds context but doesn't excuse the core issue — Tweety should have used `TaskGet` and verified requirements before executing.

**Mitigating factors**:
- Tweety self-reported this time without being prompted — the self-awareness from Failure #8's lessons appears to be taking hold
- Tweety identified the specific root cause (compaction summary vs actual requirements) accurately
- Tweety is already proceeding with rework
- Requirements DID change mid-session, which is a legitimate source of confusion

**Lessons**:
- (a) ALWAYS use `TaskGet` to read actual task requirements after compaction — never rely on compaction summaries for task details
- (b) When requirements mention a mechanism (like @references), verify it actually works before implementing across 8 files
- (c) When uncertain about whether something works ("should be verified"), STOP and verify BEFORE proceeding
- (d) Read research outputs before starting work that depends on research findings
- (e) Compaction summaries are lossy — they may contain outdated or incorrect task guidance. Treat them as context recovery, not as task specs

---

## Failure #10: Task Subject Formatting Drift After Compaction

**Timestamp**: 2026-02-17 UTC
**Reporter**: User (via team-lead)
**Category**: Process / Conventions
**Severity**: Medium

**What happened**: Tasks created during this session dropped the `#ID:` prefix convention from their subjects. Earlier in the session, tasks were consistently created as `"#108: Create incremental design behavior"`. After compaction, tasks were created as `"Create incremental design behavior"` — no ID prefix. The user noticed the inconsistency.

**Impact**: Task subjects became less scannable in TaskList output. Without the `#ID:` prefix, it's harder to quickly cross-reference tasks in messages, reviews, and the failure log. Low individual impact, but it degrades team coordination quality over time.

**Root cause**: Formatting convention was in working memory, not codified anywhere. After compaction, the convention was lost because it wasn't documented as a behavior or rule. This is the same root cause pattern as Failure #9 — compaction strips implicit conventions that aren't persisted in docs.

**Who was affected**: team-lead (primary — was the one creating tasks), but applies to all teammates who create tasks.

**Pattern**: This is the SECOND failure caused by compaction stripping undocumented conventions:
- Failure #9: Task requirements lost after compaction (Tweety)
- Failure #10: Formatting convention lost after compaction (team-lead)

Both share the same root cause: important information existed only in working memory, not in persistent docs or behaviors. Compaction is a reliable convention-killer when conventions aren't codified.

**Lessons**:
- (a) All team conventions must be codified in behaviors, not just communicated verbally or relied on in working memory
- (b) Compaction is a "convention reset" event — anything not persisted in a file will be lost
- (c) This is a systemic risk: how many other implicit conventions are currently undocumented?
- (d) The fix (creating a behavior) is itself an example of the incremental-design behavior working — a small problem leads to a specific, targeted fix

