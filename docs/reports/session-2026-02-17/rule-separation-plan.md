# Rule Separation Plan: Agent-Team Interop vs General Claude Rules

## Context
User concern: rules about agent team interoperation should live in agent-team plugins, not in general `.ai/rules/`.

## Classification

### MOVE to agent-team repo (agent interop specific)

| Rule | File | Rationale |
|------|------|-----------|
| Teammate Abstraction | `teammate-abstraction.md` | 100% agent-team specific — only applies when teammates exist |
| Research Before Broadcasting | `research-before-broadcasting.md` | Specific to orchestrator→team broadcasting pattern |
| Background sub-agent rule | In `agent-teams-skills/SKILL.md` line 163 | Already in the right place (agent-teams skill). No action needed. |

### KEEP in ai-mktpl .ai/rules/ (general behavior, applies with or without teams)

| Rule | File | Rationale |
|------|------|-----------|
| Relay Integrity | `relay-integrity.md` | Applies to ANY multi-party relay — sub-agents, MCP relays, user→tool chains. Not team-specific. Agreement bias in relay can happen without agent teams. |
| Sub-Agent Usage | `sub-agent-usage.md` | General rule about sub-agent output size. Applies to solo sessions with Task tool, not just teams. |
| All other rules | (everything else) | General Claude behavior — code quality, git, task planning, etc. |

### BORDERLINE — needs user decision

| Rule | File | Question |
|------|------|----------|
| Relay Integrity | `relay-integrity.md` | Originated from team context but the principle (don't amplify when relaying) applies generally. Keep as general? |

## Proposed Actions

1. **Move `teammate-abstraction.md`** → agent-team repo as a plugin rule/skill
2. **Move `research-before-broadcasting.md`** → agent-team repo as a plugin rule/skill
3. **Keep `relay-integrity.md`** in `.ai/rules/` (general principle)
4. **Keep `sub-agent-usage.md`** in `.ai/rules/` (general principle)
5. **No action on background sub-agent rule** — already in agent-teams skill

## Questions for Approval

- Is the relay-integrity classification correct (keep as general)?
- Should the moved rules become part of the existing `agent-teams-skills` plugin, or a new dedicated plugin?
- Should the moved rules be deleted from `.ai/rules/` or left as stubs pointing to the new location?
