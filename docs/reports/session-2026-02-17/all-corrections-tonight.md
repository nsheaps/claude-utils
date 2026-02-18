# Behavioral Corrections & Rule Changes — Tonight's Session

Compiled: 2026-02-17
Search window: last 12 hours
Repos searched: `claude-utils`, `ai-mktpl`

---

## ai-mktpl — Behavioral Corrections (Rules)

### 1. Relay Integrity — Prevent Agreement Bias in Multi-Agent Communication
- **Commit**: `0a2cf097`
- **File**: `/Users/nathan.heaps/src/nsheaps/ai-mktpl/.ai/rules/relay-integrity.md` (new)
- **Description**: Agents were adding unwarranted positive spin ("powerful idea...solves real pain points") when relaying info between user and teammates. Violates spinach rule and intellectual honesty rules. New rule requires faithful transmission and critical evaluation in relay scenarios.

### 2. Research Before Broadcasting — Orchestrator Rule
- **Commit**: `47f3d48d`
- **File**: `/Users/nathan.heaps/src/nsheaps/ai-mktpl/.ai/rules/research-before-broadcasting.md` (new)
- **Description**: Orchestrators were guessing at technical solutions and broadcasting wrong information to all teammates. Wrong broadcasts are expensive because they consume context across every agent. New rule requires research before sharing.

### 3. Task Management & Planning — Critical Updates
- **Commit**: `2718179e`
- **Files**:
  - `/Users/nathan.heaps/src/nsheaps/ai-mktpl/.ai/rules/critical-system-instructions.md`
  - `/Users/nathan.heaps/src/nsheaps/ai-mktpl/.ai/rules/task-planning.md`
  - `/Users/nathan.heaps/src/nsheaps/ai-mktpl/.ai/rules/todo-management.md`
- **Description**: Enhanced task management rules with critical updates on agent usage and task naming conventions. Added requirement for task IDs in subjects.

### 4. Critical System Instructions — Update
- **Commit**: `08831eac`
- **File**: `/Users/nathan.heaps/src/nsheaps/ai-mktpl/.ai/rules/critical-system-instructions.md`
- **Description**: Additional updates to critical system instructions rule (details in commit diff).

### 5. Task Tool Names — TodoWrite to TaskCreate/TaskUpdate/TaskList
- **Commit**: `9b1e7e64`
- **Files**:
  - `/Users/nathan.heaps/src/nsheaps/ai-mktpl/.ai/rules/critical-system-instructions.md`
  - `/Users/nathan.heaps/src/nsheaps/ai-mktpl/.ai/rules/task-planning.md`
  - `/Users/nathan.heaps/src/nsheaps/ai-mktpl/.ai/rules/todo-management.md`
- **Description**: Updated all TodoWrite references to TaskCreate/TaskUpdate/TaskList. Removed obsolete migration notes.

### 6. Ephemeral Scratch Clarification — .claude/tmp Not for Research
- **Commit**: `54423b8b`
- **File**: `/Users/nathan.heaps/src/nsheaps/ai-mktpl/.ai/rules/task-planning.md`
- **Description**: Clarified that `.claude/tmp/` is ephemeral scratch only; research belongs in `docs/research/`.

### 7. Background Sub-Agent Rule — Agent Teams
- **Commit**: `d36d3e66`
- **File**: `/Users/nathan.heaps/src/nsheaps/ai-mktpl/.ai/plugins/agent-teams-skills/skills/agent-teams/SKILL.md`
- **Description**: Orchestrators must always use `run_in_background: true` when spawning sub-agents. Foreground agents block the lead from responding to teammate messages.

### 8. Spec Terminology Consolidation — PRD to Spec
- **Commit**: `4171575f`
- **Files**:
  - `/Users/nathan.heaps/src/nsheaps/ai-mktpl/.ai/rules/mantras-and-incremental-development.md`
  - Plugin skill/template files renamed and updated
- **Description**: Consolidated "PRD" terminology to unified "spec" format. Added ~500 line soft limit guidance. Restructured template with Problem & Requirements + Technical Design sections.

---

## ai-mktpl — Skill/Plugin Updates (Behavioral)

### 9. Git-Spice Skill — Color Semantics Update
- **Commit**: `6c18cd55`
- **File**: `/Users/nathan.heaps/src/nsheaps/ai-mktpl/plugins/git-spice/skills/git-spice/SKILL.md`
- **Description**: Updated merged PRs to green, closed PRs to red color indicators.

### 10. Duplicate Message Note — Agent Teams
- **Commit**: `4ab338dc`
- **File**: Agent teams skill
- **Description**: Added note about duplicate message handling in agent teams.

---

## claude-utils — No Behavioral Corrections Found

No `/correct-behavior` runs or behavioral rule changes were found in the claude-utils repo tonight. The commits in claude-utils were operational (QA reports, research artifact moves, plugin migration, release pipeline fixes).

---

## Summary

| Repo | Corrections | New Rules | Updated Rules | Skill Updates |
|------|-------------|-----------|---------------|---------------|
| ai-mktpl | 8 | 2 (relay-integrity, research-before-broadcasting) | 6 | 2 |
| claude-utils | 0 | 0 | 0 | 0 |
| **Total** | **10** | **2** | **6** | **2** |
