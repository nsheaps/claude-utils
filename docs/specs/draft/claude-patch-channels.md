# Spec: claude-patch-channels

**Version:** iteration 5
**Status:** draft

## Problem

Claude Code v2.1.113+ ships as a Bun-compiled ELF binary (~245MB) instead of a JS bundle (~13MB). Two checks block development channel plugin loading for non-interactive agent usage:

1. **isChannelAllowlisted()** — GrowthBook-gated; returns false for non-enterprise users ([anthropics/claude-code#46742](https://github.com/anthropics/claude-code/issues/46742))
2. **DevChannelsDialog** — Interactive confirmation prompt on every launch with `--dangerously-load-development-channels` ([anthropics/claude-code#42486](https://github.com/anthropics/claude-code/issues/42486))

Existing JS-based patchers (`patch-channel-allowlist.ts`, `patch-dev-channels.ts` in agent repos) work on v2.1.112 and below but fail on the compiled binary because they read the file as UTF-8 text and do regex replacement.

## Requirements

### Must Have
- Patch both checks in a single invocation
- Support JS bundles (≤v2.1.112) AND ELF binaries (≥v2.1.113)
- Create a patched COPY — never modify the original
- Verify patched binary runs (`--version` exit 0)
- Warn on untested versions (maintain tested versions list)
- Restore option (`--restore`)
- Both patches required — fail if only one applies
- Exit non-zero on any failure

### Should Have
- `--dry-run` mode
- `--verbose` for debugging
- Idempotent — detect already-patched and skip

### Won't Have (yet)
- Auto-update on version bump (future hookify integration)
- Release/distribution via mise (follow-up after initial merge)

## Dependencies

- Python 3 (for binary patching mode)
- `file` command (for binary type detection)
- `strings` command (for verification)

## Two Modes

### Mode A: JS Bundle (≤v2.1.112)

Detected by: `file` output contains "text" or "script", or file starts with `#!`

**Patch 1 (allowlist):** Same as existing `patch-channel-allowlist.ts`:
1. Find `isChannelAllowlisted:()=>FUNC` export mapping
2. Find `function FUNC(PARAMS){...}` definition
3. Replace entire function body with `{return!0}`
4. Length does NOT need to match (text file)

**Patch 2 (dialog):** Same as existing `patch-dev-channels.ts`:
1. Find `DevChannelsDialog:()=>FUNC` export mapping
2. Find `function FUNC(PARAM){...}` definition (contains `"I am using this for local development"`)
3. Replace entire function with `function FUNC(PARAM){PARAM.onAccept()}`
4. Length does NOT need to match (text file)

### Mode B: ELF Binary (≥v2.1.113)

Detected by: `file` output contains "ELF"

The JS source is embedded as plaintext strings inside the Bun binary. Binary replacement works if:
- Replacement is **exactly the same byte length** as original
- Padding uses valid JS (block comments `/*...*/`) or minimal whitespace
- Changes are conservative (small, targeted)

**Patch 1 (allowlist):**
1. Find `isChannelAllowlisted:()=>FUNC` in binary (via `strings` or Python regex on bytes)
2. Find `function FUNC(PARAMS){...body...}` — the full function definition
3. Build replacement: `function FUNC(PARAMS){return!0}/*xxx...xxx*/` padded to exact byte length
4. Replace in binary data

**Patch 2 (dialog):**
1. Find `DevChannelsDialog:()=>FUNC` to identify the function name
2. Within that function's scope, find the switch case: `case"exit":EXITFUNC(1)`
3. Also find nearby: `case"accept":ACCEPTFUNC()` (or similar — the accept handler)
4. Replace exit handler call with accept handler call, space-padded to match byte length
5. Result: pressing "exit" now triggers accept behavior instead

**Discovery algorithm for Patch 2:**
- Both `case"exit"` and the accept handler are in the same switch statement
- The accept handler calls a function without arguments (vs exit which calls with `(1)`)
- If the accept function name can't be determined, fall back to replacing the exit call with `void 0` + padding (makes exit a no-op — dialog stays open until user naturally accepts)

## Interface

```
claude-patch-channels [OPTIONS]

Options:
  --binary <path>    Path to Claude binary (default: resolved via $(which claude))
  --output <path>    Output path (default: ~/.claude/cli.patched.js)
  --restore          Remove patched copy
  --dry-run          Show what would change without writing
  --verbose          Print detailed patch info
  --help             Show usage
```

## Verification

After patching:
1. Run `<patched-binary> --version` — must exit 0 and print version string
2. Confirm version matches the original binary's version
3. For binary mode: verify replacement strings exist at expected locations
4. Print summary: `Patched v<VERSION> → <output-path> (2/2 patches applied)`

## Tested Versions

Maintain in `docs/specs/draft/claude-patch-channels-tested-versions.md`:

| Version | Type | Patch 1 | Patch 2 | Notes |
|---------|------|---------|---------|-------|
| 2.1.94  | JS   | ✅      | ✅      | Current agent version |
| 2.1.112 | JS   | ✅      | ✅      | Last JS version |
| 2.1.113 | ELF  | ?       | ?       | First binary version (untested) |
| 2.1.119 | ELF  | ✅      | ✅      | Latest tested |

When patching an untested version: print a warning but proceed. Add version to the table after successful testing.

## Agent Harness Integration

After this tool is published, update `bin/agent` in agent repos to:
1. Remove inline patcher calls (`bun run bin/helpers/patch-*.ts`)
2. Call `claude-patch-channels` instead
3. This is a separate PR per agent repo

## Error Handling

- If target strings not found → error with "Target not found. Version may have changed or patching is no longer needed."
- If only 1/2 patches apply → error, delete partial patched copy
- If `--version` check fails on patched binary → error, delete patched copy
- If Python 3 not available for binary mode → error with install instructions

## Files

- `bin/claude-patch-channels` — main bash script
- `bin/lib/patch-binary.py` — Python helper for binary mode (called by main script)
- `docs/specs/draft/claude-patch-channels.md` — this spec

## References

- Investigation report: [nsheaps/.ai-agent-jack/docs/research/patcher-investigation/](https://github.com/nsheaps/.ai-agent-jack/tree/main/docs/research/patcher-investigation/)
- Original JS patchers: `nsheaps/.ai-agent-jack/bin/helpers/patch-channel-allowlist.ts`, `patch-dev-channels.ts`
- Binary is Bun v1.3.13 compiled; transition happened at v2.1.113
- Upstream: [anthropics/claude-code#46742](https://github.com/anthropics/claude-code/issues/46742) (allowlist), [#42486](https://github.com/anthropics/claude-code/issues/42486) (dialog)
