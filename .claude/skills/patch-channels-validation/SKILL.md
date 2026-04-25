---
name: patch-channels-validation
description: >-
  Validate that Claude Code channel patching was applied correctly.
  Use after running the patcher to confirm both patches took effect.
---

# Patch Channels Validation

## Quick Validation

```bash
CLAUDE_BIN=$(readlink -f "$(which claude)")

# 1. Binary still runs
claude --version
# Expected: "2.1.XXX (Claude Code)" — non-zero exit = broken patch

# 2. Allowlist patch applied (isChannelAllowlisted returns true)
strings "$CLAUDE_BIN" | grep -c 'return!0}\/\*x'
# Expected: > 0 (padded replacement present)

# 3. Original allowlist function is gone
strings "$CLAUDE_BIN" | grep -c 'isChannelAllowlisted.*marketplace'
# Expected: 0 if patched, > 0 if unpatched
```

## Detect "Already Patched" State

Before patching, check if the binary was previously patched:

```bash
# Check for the padding comment signature from allowlist patch
strings "$CLAUDE_BIN" | grep -q 'return!0}\/\*x' && echo "ALREADY PATCHED" || echo "NOT PATCHED"
```

## Full Verification Checklist

1. `claude --version` exits 0 and prints version string
2. Allowlist patch: `return!0` present where the original function was
3. DevChannels patch: `case"exit":K()` present (calls onAccept instead of `g4(1)`)
4. Compare file size — should be identical to original (same-length replacement)
5. Test actual plugin loading if possible (install a non-allowlisted plugin)

## Common Failure Modes

| Symptom | Cause |
|---------|-------|
| `TypeError: Expected CommonJS module` | Replacement changed byte length or broke module wrapping |
| Version prints but plugins still blocked | Only one of two patches applied |
| Segfault on startup | Binary corruption — restore from backup |

## Reference

See `docs/research/patcher-investigation/evidence-patching-results.txt` for detailed experiment logs.
