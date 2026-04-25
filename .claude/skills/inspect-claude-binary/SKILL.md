---
name: inspect-claude-binary
description: >-
  Determine what type of Claude Code binary you have (JS bundle vs Bun ELF),
  its version, and what patchable strings are present.
---

# Inspect Claude Code Binary

## Determine Binary Type

```bash
# Find the real binary path
CLAUDE_BIN=$(readlink -f "$(which claude)")

# Check file type
file "$CLAUDE_BIN"
```

- **JS bundle**: `Node.js script executable, ASCII text` — has `#!/usr/bin/env node` shebang
- **Bun ELF binary**: `ELF 64-bit LSB executable, x86-64` — compiled native binary (~245MB)

### Version Transition Point

| Versions | Format | Size |
|----------|--------|------|
| v2.1.94 - v2.1.112 | JS bundle (`cli.js`) | ~13MB |
| v2.1.113+ | Bun ELF binary (`bin/claude.exe`) | ~245MB |

**v2.1.112** is the last JS-based version. **v2.1.113** is the first Bun binary (Bun v1.3.13).

## Quick Checks

```bash
# File size (JS ~13MB, binary ~245MB)
wc -c "$CLAUDE_BIN"

# First bytes — JS has shebang, ELF has magic header
head -c 20 "$CLAUDE_BIN"
```

## Locate Patchable Strings (Binary Only)

```bash
# Key export mappings — reveals minified function names
strings "$CLAUDE_BIN" | grep 'isChannelAllowlisted:()=>'
strings "$CLAUDE_BIN" | grep 'DevChannelsDialog:()=>'

# Other useful markers
strings "$CLAUDE_BIN" | grep -c 'bun'          # ~1480 hits confirms Bun runtime
strings "$CLAUDE_BIN" | grep 'I am using this for local development'
```

The export mappings follow the pattern `EXPORTNAME:()=>FUNCNAME` — use the `FUNCNAME` to find the actual function body in the embedded JS source.

## Reference

Full investigation evidence in `docs/research/patcher-investigation/`.
