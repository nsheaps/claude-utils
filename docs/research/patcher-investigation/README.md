# Patcher Investigation: Why CLI Patching Breaks on Newer Versions

**Date:** 2026-04-25
**Investigator:** Jack Oat (AI agent)
**Versions examined:** v2.1.77, v2.1.94, v2.1.112, v2.1.119

## Summary

The patcher broke because **Claude Code transitioned from a plaintext JavaScript bundle (`cli.js`) to a Bun-compiled native ELF binary (`claude.exe`)** at version **v2.1.113**. The last JS-based version is **v2.1.112** (not v2.1.94 as previously assumed).

**Binary patching IS possible** on v2.1.119 using same-length byte replacement. Both target functions were successfully patched and the binary runs.

## Key Finding: Binary Is Bun-Compiled, Not Node.js SEA

The 245MB binary is compiled with **Bun v1.3.13**, not Node.js SEA (Single Executable Application).

Evidence:
- 1,480 strings containing "bun/Bun/@bun" in the binary
- Zero NODE_SEA/POSTJECT/node_sea_fuse markers
- Error messages report "Bun v1.3.13 (Linux x64 baseline)"
- Internal entry point: `/$bunfs/root/src/entrypoints/cli.js` (Bun virtual filesystem)
- `BUN_FEATURE_FLAG_*`, `BUN_CONFIG_*`, `BUN_JSC_*` env vars present

Evidence: [evidence-binary-type-bun.txt](evidence-binary-type-bun.txt)

### Why It's 245MB

- Bun embeds the entire runtime (JavaScriptCore engine, HTTP server, bundler, etc.)
- The JS source code (~13MB) is embedded as plaintext strings within the binary
- Debug symbols are included (binary is "not stripped")
- Native dependencies (OpenSSL, zlib, etc.) are statically linked

### Why They Switched

- Eliminates Node.js as a runtime dependency
- Faster startup time (Bun is significantly faster than Node.js for CLI tools)
- Single-file distribution (no node_modules needed)
- Same pattern as Bun's own npm distribution

## Version Transition Timeline

The transition from JS to binary happened at **v2.1.113**:

| Version | Bin Entry | Format |
|---------|-----------|--------|
| v2.1.94 - v2.1.112 | `cli.js` | JS bundle (~13MB) |
| **v2.1.113** | `bin/claude.exe` | Bun ELF binary (~245MB) |
| v2.1.119 | `bin/claude.exe` | Bun ELF binary (~245MB) |

**v2.1.112 is the last JS-based version** (previously we thought it was v2.1.94).

Evidence: [evidence-version-transition.txt](evidence-version-transition.txt)

## npm Package Architecture (v2.1.119)

The npm package is only **13.5 kB**. The 245MB binary is downloaded during `postinstall`:

```
@anthropic-ai/claude-code@2.1.119        ← 13.5 kB wrapper package
├── bin/claude.exe                        ← 500-byte stub (replaced by postinstall)
├── install.cjs                           ← postinstall: copies native binary from platform pkg
├── cli-wrapper.cjs                       ← fallback launcher for --ignore-scripts installs
├── package.json                          ← optionalDependencies for each platform
└── sdk-tools.d.ts                        ← TypeScript definitions

@anthropic-ai/claude-code-linux-x64@2.1.119  ← 245MB platform-specific package
└── claude                                ← the actual Bun-compiled binary
```

The `install.cjs` postinstall script detects the platform, finds the matching native binary from `optionalDependencies`, and copies/hardlinks it over `bin/claude.exe`.

Evidence: [evidence-npm-source-layout.txt](evidence-npm-source-layout.txt), [evidence-npm-package-json-2.1.119.txt](evidence-npm-package-json-2.1.119.txt)

## Patching Attempts on v2.1.119

### SUCCESSFUL: Binary String Replacement (Python)

**Patch 1: `sG6` (isChannelAllowlisted) — WORKS**

The JS source is embedded as plaintext strings in the binary. Same-length byte replacement works:

```python
# Original (134 bytes):
b'function sG6(H){if(!H)return!1;let{name:$,marketplace:q}=OK(H);if(!q)return!1;return y18().some((K)=>K.plugin===$&&K.marketplace===q)}'

# Replacement (134 bytes, padded with JS block comment):
b'function sG6(H){return!0}/*xxxxxxxxx...xxxxxxxxx*/'
```

Result: Binary runs, `--version` reports `2.1.119 (Claude Code)`. Found and replaced 2 occurrences.

**Patch 2: `CZ5` (DevChannelsDialog exit handler) — WORKS (minimal approach)**

```python
# Original (16 bytes):
b'case"exit":g4(1)'

# Replacement (16 bytes):
b'case"exit":K()  '  # Calls onAccept instead of exit(1)
```

Result: Binary runs with both patches applied simultaneously.

### FAILED Approaches

| # | Approach | Result | Why |
|---|----------|--------|-----|
| 1 | `NODE_OPTIONS="--require patch.js"` | Silently ignored | Binary is Bun, not Node.js |
| 2 | Aggressive CZ5 replacement (whole function + space padding) | `TypeError: Expected CommonJS module to have a function wrapper` | Space padding after closing brace disrupts Bun's module detection |
| 3 | Aggressive CZ5 replacement (function + comment padding) | Same TypeError | Replacing too much of the function body breaks Bun's internal module wrapping |

### PARTIALLY SUCCESSFUL

| # | Approach | Result |
|---|----------|--------|
| 4 | `BUN_OPTIONS="--preload patch.js"` | Preload executes but can't intercept module-scoped functions. Could be extended with Bun.plugin API research |

### NOT ATTEMPTED (but feasible)

- LD_PRELOAD interception of libc calls
- Bun-specific import hooks via `Bun.plugin()` API in preload
- ptrace-based runtime patching
- Extracting embedded JS from Bun binary, patching, re-bundling

Evidence: [evidence-patching-results.txt](evidence-patching-results.txt)

## Evidence: Target Strings in Binary

The strings the patcher looks for ARE present as plaintext in the v2.1.119 binary:

| String | Count in binary |
|--------|----------------|
| `isChannelAllowlisted` | 3 |
| `DevChannelsDialog` | 4 |
| `I am using this for local development` | present |
| Export mapping: `isChannelAllowlisted:()=>sG6` | present |
| Export mapping: `DevChannelsDialog:()=>CZ5` | present |

## Evidence: File Type Change

### v2.1.94 — JavaScript (Node.js script)
```
file output: Node.js script executable, ASCII text, with very long lines (58652)
Real path:   .../2.1.94/lib/node_modules/@anthropic-ai/claude-code/cli.js
Size:        13,308,322 bytes (~13MB)
Shebang:     #!/usr/bin/env node
```

### v2.1.119 — Bun-compiled ELF binary
```
file output: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked,
             interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 3.2.0,
             BuildID[sha1]=8a271a1661cb09cb7811f021a8fa3bd9b72d547d, not stripped
Real path:   .../2.1.119/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe
Size:        245,230,208 bytes (~245MB)
Runtime:     Bun v1.3.13 (Linux x64 baseline)
```

## Evidence: Patcher Works on v2.1.94

Both patchers succeed on v2.1.94 (and should work up to v2.1.112):

Evidence: [evidence-patcher-allowlist-2.1.94-output.txt](evidence-patcher-allowlist-2.1.94-output.txt), [evidence-patcher-devchannels-2.1.94-output.txt](evidence-patcher-devchannels-2.1.94-output.txt)

## How the Patchers Work

Both scripts in `bin/helpers/`:

1. Find the claude binary via `which claude` + `readlink -f`
2. **Read the file as UTF-8 text** via `readFileSync(cliPath, 'utf-8')`
3. Use regex to find export mappings (e.g., `isChannelAllowlisted:()=>FUNCNAME`)
4. Locate the function definition in the JS source
5. Replace the function body with a patched version
6. Write the patched JS to `~/.claude/cli.patched.js`

This approach works for JS bundles but needs adaptation for Bun binaries.

## Recommended Path Forward

### Option 1: Update patchers for binary support (RECOMMENDED)

The existing patchers can be extended to handle Bun binaries:

1. Detect file type (JS text vs ELF binary) using magic bytes or `file` command
2. For JS: use existing text-based approach (unchanged)
3. For Bun binary: use Python/binary replacement with same-length padding
4. Key constraints: replacement must be exactly same byte length, pad with JS block comments `/*...*/`
5. Write patched binary back to same path (with backup)
6. Test that patched binary still runs (`--version` check)

### Option 2: Pin to v2.1.112 (SAFE FALLBACK)

v2.1.112 is the last JS-based version, not v2.1.94. This gives us 18 more versions of bug fixes and features while maintaining text-based patchability.

### Option 3: BUN_OPTIONS preload (EXPERIMENTAL)

`BUN_OPTIONS="--preload /tmp/patch.js"` executes code before the app loads. This could work if we can find a way to intercept module-scoped functions via `Bun.plugin()` API. Needs more research.

## Installed Versions

```
2.1.77   — JS bundle (cli.js)
2.1.94   — JS bundle (cli.js) ← currently active
2.1.112  — JS bundle (cli.js) ← last JS version (not installed)
2.1.119  — Bun binary (claude.exe) ← latest, patchable via binary replacement
```
