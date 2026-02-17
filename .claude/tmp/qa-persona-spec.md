# QA Report: Persona System Design Spec

**QA Agent**: Daffy Duck (Quality Assurance)
**Date**: February 16, 2026
**Deliverable Under Review**: `docs/specs/draft/persona-system.md` (commit a0441fe)
**Deliverable Author**: Tweety Bird (Docs Writer)
**Repo**: nsheaps/agent-team

---

## Overall Verdict: PASS (with 3 broken references — Medium severity)

The spec is substantive, covers all 5 requested areas thoroughly, is consistent with existing persona and agent files, and has no contradictions with team docs. Three internal references point to files that don't exist at the referenced paths, requiring correction.

---

## Verification Criteria

### 1. File Exists and Is Substantive — PASS

- **Location**: `/Users/nathan.heaps/src/nsheaps/agent-team/docs/specs/draft/persona-system.md`
- **Size**: 473 lines
- **Sections**: 10 (Problem Statement, Current State, Design: File Format, Runtime Loading, Channel Interaction Model, Voice Consistency, Persona Evolution, Multi-Persona Scenarios, Implementation Phases, Open Questions)
- **Assessment**: Comprehensive design spec with diagrams, tables, code examples, phased implementation plan, and open questions. Not a stub.

### 2. Covers 5 Requested Areas — PASS

| Area | Section | Lines | Assessment |
|------|---------|-------|------------|
| **Runtime loading** | Section 4 | 140–197 | 3 mechanisms detailed (SessionStart hook, CLAUDE.md @references, MCP server) with pros/cons/mitigations and phased rollout table |
| **Channel interaction** | Section 5 | 200–249 | ASCII architecture diagram, channel-specific behaviors table (Slack/GitHub/Blog/Reddit with 7 aspects each), consistency rule with 4 invariants |
| **Voice consistency** | Section 6 | 253–305 | 4 mechanisms (persona anchoring, pre-action check, coach review, feedback loop) with proposed behavior file code block |
| **Persona evolution** | Section 7 | 309–377 | Evolution model flowchart, what-can-evolve table with approval levels, evolution log format, 4 anti-patterns |
| **Multi-persona scenarios** | Section 8 | 380–418 | v1 decision (not supported) with rationale, 4 scenarios where it makes sense, v2 design proposal, shared-persona support |

All 5 areas are covered substantively with concrete proposals, not just placeholders.

### 3. References Included — PASS (with 3 broken references)

The spec includes a References section (lines 452–473) with 3 categories:

**Current Implementation** (4 references):
| Reference | Exists? | Status |
|-----------|---------|--------|
| `.claude/personas/*.md` (8 files, commit ae83a35) | YES — 8 files confirmed | ✅ |
| `**Persona**: .claude/personas/<name>.md` in agent files | YES — confirmed in all 8 agent files | ✅ |
| `.claude/docs/team-structure.md` ("Agent vs Persona" section) | YES — section confirmed at lines 33–46 | ✅ |
| `.claude/skills/writing-agent-team-agents/SKILL.md` | **NO** — file does not exist in either repo | **BROKEN** |

**Related Research** (3 references):
| Reference | Relative Path Resolves To | Exists? | Status |
|-----------|--------------------------|---------|--------|
| Persona loading research | `.claude/tmp/persona-loading-research.md` (agent-team) | NO in agent-team; YES in claude-utils | **BROKEN** (cross-repo) |
| Agent prompt best practices | `.claude/tmp/agent-prompt-research.md` (agent-team) | NO in agent-team; YES in claude-utils | **BROKEN** (cross-repo) |
| Claude-Flow research | `docs/research/claude-flow.md` (agent-team) | YES | ✅ |

**External References** (4 references):
| Reference | URL | Format |
|-----------|-----|--------|
| Claude Code Sub-Agents | `https://code.claude.com/docs/en/sub-agents` | ✅ properly formatted |
| Claude Code Hooks | `https://code.claude.com/docs/en/hooks` | ✅ properly formatted |
| Claude Code Agent Teams | `https://code.claude.com/docs/en/agent-teams` | ✅ properly formatted |
| Model Context Protocol | `https://modelcontextprotocol.io/` | ✅ properly formatted |

**Broken Reference Details**:

1. **`.claude/skills/writing-agent-team-agents/SKILL.md`**: Task #28 created this skill, but it appears to have been removed or relocated during the marketplace conversion (tasks #66, #75, #76). The file no longer exists in either agent-team or claude-utils repos. Severity: **Medium** — the reference should be updated or removed.

2. **`../../.claude/tmp/persona-loading-research.md`**: The relative path from `docs/specs/draft/` resolves to `.claude/tmp/persona-loading-research.md` in the agent-team repo, but that directory is empty. The file exists at `/Users/nathan.heaps/src/nsheaps/claude-utils/.claude/tmp/persona-loading-research.md` — different repo. Severity: **Medium** — cross-repo reference needs correction.

3. **`../../.claude/tmp/agent-prompt-research.md`**: Same issue as above. Exists in claude-utils `.claude/tmp/`, not in agent-team. Severity: **Medium** — cross-repo reference needs correction.

### 4. Consistent with Existing Persona Files — PASS

**v1 format described in spec vs actual persona files:**

The spec (section 3, lines 49–74) describes v1 format as:
- Identity (Full Name, Character Inspiration, Disclaimer)
- Personality Traits
- Communication Style
- Public Voice
- Avatar Concept

All 8 persona files verified against this structure:

| Persona | Identity | Traits | Comm Style | Public Voice | Avatar | Match |
|---------|----------|--------|------------|-------------|--------|-------|
| orchestrator.md | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| coach.md | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| docs-writer.md | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| deep-researcher.md | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| ops-engineer.md | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| software-engineer.md | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| quality-assurance.md | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| project-manager.md | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Spec claims "8 files" in Phase 0**: Confirmed — exactly 8 persona files exist.

**Spec's v2 proposal**: Proposes replacing "Public Voice" with "Channel Voices" and adding "Evolution Log". This is clearly framed as a proposed change (Phase 2/Phase 5), not a claim about current state. No inconsistency.

### 5. No Contradictions with Agent Files or Team Docs — PASS

**Checked against `team-structure.md`:**
- Spec says "Agent = job, Persona = person" → team-structure.md section "Agent vs Persona" says same ✅
- Spec says system-message provides core identity → team-structure.md confirms ✅
- Spec says personas are "documentation only" today → team-structure.md doesn't claim automated loading ✅

**Checked against agent files (sampled docs-writer.md, coach.md):**
- Agent files have `<system-message>` blocks with core identity → spec section 6 correctly references this as "persona anchoring" ✅
- Agent files have `**Persona**: .claude/personas/<name>.md` pointer → spec section 2 correctly describes this ✅
- Agent files say personas define "public-facing identity for Slack, GitHub, and external communications" → spec's channel interaction model is consistent ✅

**Checked for trait consistency:**
- Spec section 7 anti-patterns: "If Wile E. Coyote's core trait is 'warm but blunt,' don't make them diplomatic" → coach.md persona: "Warm but blunt — tells you about a problem before you walk into it" ✅ exact match
- Spec section 5 consistency rule says "core personality traits" must remain constant across channels → no persona file contradicts this ✅

**Checked for role/responsibility contradictions:**
- Spec proposes Coach role in voice consistency (section 6) → coach agent file's responsibilities include reviewing specs and recording patterns ✅ consistent
- Spec proposes a `public-action.md` behavior → doesn't exist yet, but spec correctly lists it as Phase 3 (not done) ✅ no false claim

**No contradictions found.**

---

## Issues Summary

| # | Severity | Type | Description |
|---|----------|------|-------------|
| 1 | Medium | Broken reference | `.claude/skills/writing-agent-team-agents/SKILL.md` — skill removed/moved during marketplace conversion, reference stale |
| 2 | Medium | Broken reference | `../../.claude/tmp/persona-loading-research.md` — file exists in claude-utils repo, not agent-team repo; relative path resolves incorrectly |
| 3 | Medium | Broken reference | `../../.claude/tmp/agent-prompt-research.md` — same cross-repo issue as #2 |

**Recommendation**: These broken references should be fixed before the spec moves from "draft" to "reviewed" status. Options:
- For issues #2 and #3: Copy the research files from claude-utils `.claude/tmp/` into agent-team, or change to absolute paths, or note the files are in a different repo
- For issue #1: Remove the reference or update to wherever the skill landed after marketplace conversion

---

## Strengths

1. **Clear separation of current state vs proposals** — each section explicitly distinguishes "what exists today" from "what we propose"
2. **Phased implementation plan** (section 9) — 7 phases with clear scope and deliverables
3. **Concrete code examples** — SessionStart hook JSON, MCP tool interface, behavior file template
4. **ASCII architecture diagrams** — visual communication of layering model
5. **Open questions section** — 6 honest unresolved questions show intellectual rigor
6. **Anti-patterns** — section 7 explicitly lists what NOT to do, preventing common mistakes
7. **v2 format proposal** — backward-compatible extension of v1, not a breaking change

---

## Conclusion

**PASS** — The persona system design spec is substantive (473 lines), covers all 5 requested areas with depth and concrete proposals, includes references, matches all 8 existing persona files, and contains no contradictions with agent files or team docs. Three broken internal references (Medium severity) should be fixed before advancing the spec from draft status. These are reference path issues, not content problems.
