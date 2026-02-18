# Statusline + Agent Teams Rate Limit Fix — Implementation

## Problem

`bin/statusline.sh` makes 3 expensive external calls on every invocation:
1. `gh pr view --json url -q .url` — GitHub API call
2. `gh repo view --json url -q .url` — GitHub API call
3. `uvx --from par-cc-usage pccu statusline` — Python tool via uvx

With 7+ agents in a team, each agent's statusline multiplies these calls, quickly hitting GitHub API rate limits (~5,000/hour).

## Solution: Disable Statusline for Teammates

Per team lead direction: teammates should NOT have a statusline at all. Only the lead and solo sessions need one.

### Detection Mechanism

`CLAUDE_CODE_PARENT_SESSION_ID` is set by Claude Code for spawned teammates but NOT for the team lead or solo sessions. Source: [Road Runner's teammate launch research](teammate-launch-research.md), which references:
- [Official Docs: Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [Issue #25375](https://github.com/anthropics/claude-code/issues/25375) — reveals spawn command structure

### Changes Made

**`bin/statusline.sh`** (lines 6-12):
```bash
# Skip statusline entirely for agent team teammates.
if [ -n "${CLAUDE_CODE_PARENT_SESSION_ID:-}" ]; then
  exit 0
fi
```

**`hooks/configure-statusline.sh`** (lines 5-10):
```bash
# Skip configuration for agent team teammates to avoid race conditions
# on the shared settings.json file.
if [ -n "${CLAUDE_CODE_PARENT_SESSION_ID:-}" ]; then
  echo '{}'
  exit 0
fi
```

**`README.md`**: Added "Agent Teams" section documenting the behavior.

### Impact

| Scenario | Before | After |
|----------|--------|-------|
| Solo session | Full statusline | Full statusline (unchanged) |
| Team lead | Full statusline | Full statusline (unchanged) |
| Teammate (×7) | Full statusline + 2 gh calls each | No statusline, no API calls |
| Team API calls/min | ~140 | ~20 (lead only) |

### Why Not Caching?

The original proposal (file-based cache with TTL) was more complex than needed. The team lead clarified that teammates don't need a statusline at all, making the fix a simple early-exit guard.
