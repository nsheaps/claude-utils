# Issues Requiring User Attention

Compiled by Coach (Wile E. Coyote) for inclusion in session report.

## Analysis: Which OPEN issues need the user?

Categorized by: **Decisions** (only user can make), **Credentials** (only user can add), **Manual action** (destructive/risky, needs user approval), **Security** (user should be aware).

---

## Proposed Section for Report

### Issues Requiring Your Attention

These open issues require your decision, action, or awareness. Grouped by type.

#### Decisions Needed

| Repo | Issue | Title | Why You |
|------|-------|-------|---------|
| agent-team | [#5](https://github.com/nsheaps/agent-team/issues/5) | Decision needed: Add Homebrew formula publishing to release pipeline? | Strategic decision — affects distribution model |
| agent-team | [#8](https://github.com/nsheaps/agent-team/issues/8) | License mismatch: MIT file vs UNLICENSED vs Proprietary | Legal decision — affects contribution model |
| agent-team | [#9](https://github.com/nsheaps/agent-team/issues/9) | Decide authority for verify-before-blaming rule | Process decision — rule scope |
| agent | [#7](https://github.com/nsheaps/agent/issues/7) | package.json says UNLICENSED but LICENSE file says MIT | Same license decision as agent-team #8 |

#### Credentials / Secrets

| Repo | Issue | Title | Why You |
|------|-------|-------|---------|
| agent-team | [#4](https://github.com/nsheaps/agent-team/issues/4) | Add AUTOMATION_GITHUB_APP_ID and AUTOMATION_GITHUB_APP_PRIVATE_KEY secrets | Only repo admin can add secrets |
| agent | [#9](https://github.com/nsheaps/agent/issues/9) | Add AUTOMATION_GITHUB_APP_ID and AUTOMATION_GITHUB_APP_PRIVATE_KEY secrets | Same — repo admin action |

#### Manual Action (Destructive)

| Repo | Issue | Title | Why You |
|------|-------|-------|---------|
| agent | [#4](https://github.com/nsheaps/agent/issues/4) | Add dist/ to .gitignore — 60MB binary committed | Cleaning git history requires force push — needs your approval |

#### Security (Awareness)

| Repo | Issue | Title | Why You |
|------|-------|-------|---------|
| agent-team | [#59](https://github.com/nsheaps/agent-team/issues/59) | CRITICAL: Add shell argument sanitization in spawn.ts | Security vulnerability — agent names passed unsanitized to shell commands |

#### Upstream (External)

| Repo | Issue | Title | Notes |
|------|-------|-------|-------|
| anthropics/claude-code | [#25037](https://github.com/anthropics/claude-code/issues/25037) | Delegate mode: teammates inherit restrictions incorrectly | Platform bug affecting agent teams — no action needed, tracking only |

---

## Untracked Action Item

**sync-settings.py cross-plugin race**: The `sync-settings` plugin writes to `~/.claude/settings.json` without any file locking. Now that the statusline plugins use mkdir-based locks, sync-settings could still race with them. This should be tracked as a GitHub Issue on `nsheaps/ai-mktpl`.

Bugs should create this issue before finalizing the report.
