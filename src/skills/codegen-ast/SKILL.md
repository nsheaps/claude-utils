# Codegen Conversion Strategy (AST/Template-Based)

Use the TypeScript compiler API for programmatic code generation to convert plugin components between Claude Code and OpenCode formats. No AI, no API keys — purely deterministic.

## When to Use Codegen

- **Always free** — No API keys or accounts required
- **Deterministic** — Same input always produces identical output
- **Fast** — No network calls, runs entirely locally
- **CI/CD friendly** — Predictable output, no external dependencies
- **Better than rule-based** — Produces syntactically valid TypeScript via AST

## How It Works

1. **Parse** — Uses existing parsers to read source plugin files
2. **Convert** — Applies rule-based component converters (hooks, MCP, skills, agents, commands)
3. **Generate** — Uses TypeScript AST API to produce properly structured output files
4. **Write** — Writes generated files to the output directory

### TypeScript AST Generation

For TypeScript output files (hooks plugins, command stubs), the codegen strategy:
- Builds proper AST nodes using `ts.factory`
- Creates import declarations, function signatures, and typed parameters
- Generates event subscriptions with proper handler wrappers
- Prints the AST using `ts.createPrinter()` for correctly formatted output

### Template-Based Generation

For non-TypeScript files (markdown, JSON configs):
- Programmatic JSON construction with proper structure
- Markdown with YAML frontmatter for Claude Code commands
- Content preservation for skills/instructions

## CLI Usage

```bash
# Convert with AST codegen (free, no API key needed)
plugin-convert convert -s ./my-plugin -t ./out --codegen

# Explicit strategy selection
plugin-convert convert -s ./my-plugin -t ./out --strategy codegen

# Marketplace batch codegen
plugin-convert marketplace convert \
  -s ./marketplace -t ./marketplace-oc --codegen --generate-docs
```

## Strategy Comparison

| Strategy | AI? | Cost | TypeScript Quality | Speed |
|----------|-----|------|--------------------|-------|
| Rule-based | No | Free | String concatenation | Instant |
| **Codegen (AST)** | **No** | **Free** | **AST-generated, syntactically valid** | **Instant** |
| One-Shot | Yes | ~$0.01 | AI-generated, may need review | ~3-8s |
| Agentic | Yes | ~$0.10-0.50 | AI-generated with tool use | ~30-120s |

## Generated File Examples

### OpenCode Hooks Plugin (Claude→OpenCode)
The codegen produces proper TypeScript with:
- Type-only import of `PluginContext`
- Async arrow function with destructured parameters
- Event subscriptions via `client.event.subscribe()`
- Shell command handlers with `execSync` and environment passing

### TypeScript Command Stubs (Claude→OpenCode)
The codegen produces proper TypeScript with:
- Export default object with typed properties
- Async handler method with `Record<string, unknown>` parameter typing
- Parameter declarations matching source frontmatter

### Claude Code hooks.json (OpenCode→Claude)
Programmatic JSON with:
- Proper event name mapping (beforeTool → PreToolUse, etc.)
- Matcher patterns from source hooks
- Shell command wrapping for TypeScript handlers
