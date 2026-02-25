# Codegen Conversion Strategy

Use the Anthropic Messages API for single-shot code generation to convert plugin components between Claude Code and OpenCode formats.

## Three AI Conversion Strategies

| Strategy | How It Works | Best For |
|----------|-------------|----------|
| **Agentic (Claude SDK)** | Multi-turn agent with tool use via `@anthropic-ai/claude-agent-sdk` | OpenCode → Claude Code; complex conversions needing file exploration |
| **Agentic (OpenCode SDK)** | Multi-turn agent via `@opencode-ai/sdk` | Claude Code → OpenCode; leveraging OpenCode's native understanding |
| **Codegen** | Single API call with all source inlined; structured JSON response | Fast/cheap conversions, CI pipelines, deterministic output |

## When to Use Codegen

- **CI/CD pipelines** — Deterministic, single request, easy to budget
- **Batch marketplace conversion** — Cheaper than agentic per-plugin
- **Hook conversion** — Codegen excels at structural transformations
- **Command conversion** — Markdown ↔ TypeScript stub generation
- **When no SDK is installed** — Only needs `ANTHROPIC_API_KEY`, no npm packages

## When to Use Agentic Instead

- **Complex multi-file plugins** — Agent can explore and understand cross-file dependencies
- **Large plugins** — Source files exceed single API call context limits
- **Iterative refinement** — Agent can test/validate its own output

## How Codegen Works

1. **Collect** — Reads all source files for the requested component
2. **Prompt** — Builds a structured prompt with format knowledge and source content inline
3. **Call** — Single `POST /v1/messages` to the Anthropic API
4. **Parse** — Extracts generated files from the JSON response
5. **Write** — Writes files to the output directory

The response format is a JSON object:
```json
{
  "reasoning": "Converted 2 hooks from PreToolUse matchers to event subscriptions...",
  "files": [
    { "path": ".opencode/plugins/hooks.ts", "content": "..." },
    { "path": "opencode.json", "content": "..." }
  ],
  "warnings": ["Inline handler needs manual review"]
}
```

## CLI Usage

```bash
# Basic codegen conversion
plugin-convert convert -s ./my-plugin -t ./out --codegen

# With explicit model and API key
plugin-convert convert -s ./my-plugin -t ./out --codegen \
  --api-key sk-ant-... --model claude-sonnet-4-20250514

# With custom API base URL (for proxies or compatible APIs)
plugin-convert convert -s ./my-plugin -t ./out --codegen \
  --base-url https://my-proxy.example.com

# Explicit strategy selection
plugin-convert convert -s ./my-plugin -t ./out --strategy codegen

# Marketplace batch codegen
plugin-convert marketplace convert \
  -s ./marketplace -t ./marketplace-oc --codegen --generate-docs
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | API key for codegen (or use `--api-key`) |
| `ANTHROPIC_BASE_URL` | Custom base URL (or use `--base-url`) |

## Strategy Auto-Selection

When `--strategy auto` (the default when neither `--agentic` nor `--codegen` is set):

1. If direction is Claude→OpenCode and OpenCode SDK installed → use OpenCode SDK
2. If direction is OpenCode→Claude and Claude SDK installed → use Claude SDK
3. If `ANTHROPIC_API_KEY` set → use codegen as fallback
4. If any agentic SDK installed → use it
5. Otherwise → no AI conversion (rule-based only)

## Cost Comparison

| Strategy | Typical Cost per Plugin | Latency |
|----------|------------------------|---------|
| Codegen (Haiku) | ~$0.001–0.01 | ~2–5s |
| Codegen (Sonnet) | ~$0.01–0.05 | ~3–8s |
| Agentic (SDK) | ~$0.10–0.50 | ~30–120s |

## Fallback Behavior

If the API returns non-JSON (e.g., markdown with code blocks), the parser falls back to extracting files from markdown code block patterns like:

```
### path/to/file.ts
\`\`\`typescript
// file content
\`\`\`
```

This ensures robustness even with varying model output formats.
