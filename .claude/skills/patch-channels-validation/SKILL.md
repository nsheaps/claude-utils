---
name: patch-channels-validation
description: >-
  Validate that Claude Code channel patching was applied correctly.
  Use after running the patcher to confirm both patches took effect.
---

# Patch Channels Validation

## CRITICAL: Patcher success ≠ patch effective

**The patcher reporting "4 patches applied successfully" is NECESSARY but NOT SUFFICIENT.** The patcher only confirms it found and rewrote bytes at the expected pattern locations. It does NOT confirm the rewritten code actually changes runtime behavior.

Failure modes where the patcher says ✅ but behavior is unchanged:

- The pattern matched, but the matched function was inlined elsewhere or has duplicates the patcher didn't catch.
- Bun's bytecode cache contains a pre-compiled copy of the original code that runs INSTEAD of the patched JS source. (This is why Patch 4 zeros bytecode pointers — but if Bun adds new cache locations, that patch can be incomplete.)
- The patched function is still defined correctly, but a different code path (e.g., a different version of the dialog, a different allowlist check site) is what actually runs.
- A new internal call site was added in this version that the patcher's pattern doesn't cover.

**Always validate behavior, not just patcher output.** Specifically:
1. Launch claude with `--dangerously-load-development-channels` and a non-allowlisted channel plugin.
2. Confirm the DevChannelsDialog does NOT appear (dialog auto-accepts via the patch).
3. Confirm the channel plugin's tools/MCP/messages actually load (allowlist patch effective).
4. If the dialog DOES appear, or the channel plugin doesn't load — the patcher succeeded but the patch is INEFFECTIVE. Treat as a regression and investigate before marking the version tested.

This is a documented historical failure: see `docs/research/patcher-investigation/` for cases where Patch 2/3 reported OK on certain versions but the dialog still appeared at runtime.

Source: Handler instruction (2026-05-05): "Remember the patcher can succeed but the patch can still not successfully change the behavior."

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
