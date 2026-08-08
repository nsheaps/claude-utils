---
name: binary-patching-methodology
description: >-
  Core methodology for patching Bun-compiled Claude Code binaries.
  Use when implementing or updating the channel patcher for ELF binaries.
---

# Binary Patching Methodology

## Why Text-Based Patching Fails on ELF Binaries

The JS source is embedded as plaintext strings inside the Bun binary, but:
- Reading as UTF-8 text corrupts binary sections
- `writeFileSync` with UTF-8 encoding destroys the ELF structure
- `NODE_OPTIONS` is ignored (Bun, not Node.js)

## Working Approach: Same-Length Binary Replacement

Use Python (or any tool that handles raw bytes) to find and replace byte sequences:

```python
with open(binary_path, 'rb') as f:
    data = f.read()

original = b'function sG6(H){if(!H)return!1;let{name:...'  # exact bytes
replacement = b'function sG6(H){return!0}/*xxxxxxxxx...*/'  # same length

assert len(original) == len(replacement)  # CRITICAL
data = data.replace(original, replacement)

with open(binary_path, 'wb') as f:
    f.write(data)
```

## Critical Constraints

1. **Replacement MUST be exact same byte length** — even one byte difference corrupts the binary
2. **Pad with JS block comments** `/*...*/` to fill remaining space
3. **Never restructure function signatures** — only replace the body
4. **Minimal changes are safest** — small targeted replacements over aggressive rewrites

## Padding Strategies

| Strategy | Example | Safety |
|----------|---------|--------|
| Block comment padding | `return!0}/*xxxx*/` | Safe — JS parser ignores comments |
| Space padding after `}` | `return!0}   ` | UNSAFE — breaks Bun module detection |
| Trailing semicolons | `return!0};;;` | UNSAFE — may break parsing |

## What Works vs What Breaks

**Works:**
- Replacing function body with short return + comment padding
- Small targeted replacements (e.g., `g4(1)` → `K()  `)
- Multiple patches in the same binary (applied sequentially)

**Breaks:**
- Space padding after closing brace → `TypeError: Expected CommonJS module`
- Replacing too much of a function → breaks Bun's module wrapping
- Any change to byte length → corrupts ELF structure

## Finding Target Functions

1. Find export mapping: `strings binary | grep 'EXPORTNAME:()=>'`
2. Extract minified name from mapping (e.g., `isChannelAllowlisted:()=>sG6` → `sG6`)
3. Find function body: `strings binary | grep 'function sG6('`
4. Measure exact byte length of original
5. Craft replacement of identical length

## Reference

Full evidence and experiment results in `docs/research/patcher-investigation/`.
