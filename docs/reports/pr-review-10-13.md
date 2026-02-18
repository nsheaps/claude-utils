# QA Review: PRs #10 and #13 on agent-team

**Reviewer**: Daffy Duck (Quality Assurance)
**Date**: 2026-02-18

---

## PR #13 — fix: health subcommand + relaunch stale discovery (QA-4/7/9)

**CI Status**: PASSING (lint + test both green)
**Files**: 3 changed (+34, -20)

### QA-4/7: Health subcommand now uses isTmuxPaneAlive()

**Verdict: CORRECT FIX**

The diff adds:
```typescript
import { isTmuxPaneAlive } from "../src/lifecycle";
import type { AgentStatus } from "../src/lifecycle";
```

And replaces the hardcoded "UNKNOWN" with:
```typescript
let status: AgentStatus;
if (member.tmuxPaneId) {
  status = isTmuxPaneAlive(member.tmuxPaneId) ? "RUNNING" : "DEAD";
} else {
  status = "UNKNOWN";
}
```

This matches the pattern already used in `listAgents()` at lifecycle.ts:268-269. The note message is also improved — only shows when there are actually untracked members, instead of always.

No issues found.

### QA-9: Relaunch uses fresh discovery

**Verdict: CORRECT FIX**

The diff replaces:
```typescript
const agent = discoverResult.agents.find((a) => a.name === agentFilter);
```

With:
```typescript
const freshDiscover = await discoverAgents(projectRoot);
for (const err of freshDiscover.errors) {
  console.error(`ERROR [${err.filename}]: ${err.message}`);
}
const agent = freshDiscover.agents.find((a) => a.name === agentFilter);
```

This correctly re-discovers after kill, and properly handles discovery errors (matching the pattern at the top of agent-launch.ts). Good.

### Formatting changes

Two rules files (`.claude/rules/README.md`, `.claude/rules/teammate-abstraction.md`) have prettier formatting applied to markdown tables. These are cosmetic only. Note: `teammate-abstraction.md` formatting is also in PR #10 — this will cause a merge conflict if #10 merges first.

### PR #13 Conclusion: **APPROVE** — all fixes are correct and CI passes.

---

## PR #10 — fix: release pipeline + CI issues from swarm review (OPS-2/3/4/6/7/8)

**CI Status**: FAILING (both lint and test)
**Files**: 7 changed (+23, -1935)

### CI Failure Root Cause

Both jobs fail at `bun install --frozen-lockfile`:
```
error: lockfile had changes, but lockfile is frozen
note: try re-running without --frozen-lockfile and commit the updated lockfile
```

**Analysis**: The PR adds `--frozen-lockfile` to all `bun install` commands (OPS-8), but the existing `bun.lock` on the branch is stale. The lockfile doesn't match what `bun install` would generate from `package.json`. The fix introduced a problem it was trying to prevent.

**Required fix**: Run `bun install` on the branch and commit the updated `bun.lock`.

### OPS-2: GITHUB_TOKEN env for release-it

Added `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` to the release step env. **Correct** — release-it needs this for GitHub release creation.

### OPS-3: Release job outputs

Added `outputs` block capturing version and tag from release-it output. **Correct** — needed for downstream Homebrew publishing step.

### OPS-4: checkout@v6 → @v4

Changed `actions/checkout@v6` to `@v4` in composite auth action. **Correct** — v6 doesn't exist; v4 is the latest stable.

### OPS-6: Prettier formatting on teammate-abstraction.md

Table alignment fixed. **Correct** — resolves lint failure on main.

### OPS-7: Remove yarn.lock + add to .gitignore

Deleted 1924-line `yarn.lock` and added `yarn.lock` to `.gitignore`. **Correct** — project uses bun, not yarn. The lockfile was orphaned.

### OPS-8: --frozen-lockfile

Added `--frozen-lockfile` to all `bun install` commands in CI. **Correct intent, broken execution** — the bun.lock is stale, so this flag causes CI to fail.

### Bonus: lint depends on fmt-check

`mise.toml` change makes lint depend on fmt-check instead of duplicating the prettier check. **Correct** — DRY improvement.

### Merge conflict risk

Both PR #10 and PR #13 modify `.claude/rules/teammate-abstraction.md` with identical formatting changes. Whichever merges second will have a conflict. Recommend merging #13 first (it passes CI), then rebasing #10 and dropping the duplicate change.

### PR #10 Conclusion: **REQUEST CHANGES**

1. **BLOCKING**: Run `bun install` and commit updated `bun.lock` to fix CI failure
2. **WARNING**: Merge conflict with PR #13 on `teammate-abstraction.md` — merge #13 first, then rebase #10

All OPS fixes are correct in intent and implementation. Only the stale lockfile blocks merging.

---

## Summary

| PR | Verdict | CI | Blocking Issues |
|----|---------|-----|-----------------|
| #13 | **APPROVE** | PASS | None |
| #10 | **REQUEST CHANGES** | FAIL | Stale bun.lock breaks --frozen-lockfile |

### Recommended Merge Order
1. Merge PR #13 first (passes CI, no issues)
2. On PR #10: run `bun install`, commit updated `bun.lock`, rebase to resolve teammate-abstraction.md conflict
3. Then merge PR #10
