# Plugin Structure Conversion Guide

Convert plugin directory structures between Claude Code and OpenCode formats.

## Claude Code Plugin Structure

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json          # Manifest (name, version, description, author)
├── skills/
│   └── my-skill/
│       ├── SKILL.md          # Skill content (auto-activated by context)
│       └── references/       # Supporting files
├── commands/
│   └── my-command.md         # Slash command (user-invoked, markdown)
├── agents/
│   └── my-agent.md           # Subagent definition (markdown)
├── hooks/
│   └── hooks.json            # Hook configurations
├── .mcp.json                 # MCP server definitions
├── settings.json             # Default plugin settings
└── README.md
```

## OpenCode Plugin Structure

```
my-plugin/
├── opencode.json             # Config (name, version, providers, hooks, mcp, agents)
├── .opencode/
│   ├── plugins/
│   │   └── my-plugin.ts      # TypeScript plugin module
│   └── agents/
│       └── my-agent.md       # Agent definition (markdown)
├── instructions/
│   └── my-skill/
│       └── README.md          # Instruction content (like skills)
├── commands/
│   └── my-command.ts          # Command handler (TypeScript module)
└── README.md
```

## Mapping Between Formats

| Component | Claude Code | OpenCode |
|-----------|------------|----------|
| Manifest | `.claude-plugin/plugin.json` | `opencode.json` |
| Skills/Instructions | `skills/*/SKILL.md` | `instructions/*/README.md` |
| Commands | `commands/*.md` (markdown) | `commands/*.ts` (TypeScript) |
| Agents | `agents/*.md` | `.opencode/agents/*.md` |
| Hooks | `hooks/hooks.json` (declarative) | `.opencode/plugins/*.ts` (code) |
| MCP Servers | `.mcp.json` | `opencode.json` → `mcpServers` |
| Settings | `settings.json` | `opencode.json` (merged) |

## Manifest Field Mapping

| Claude Code (`plugin.json`) | OpenCode (`opencode.json`) |
|------------------------------|----------------------------|
| `name` | `name` |
| `version` | `version` |
| `description` | `description` |
| `author.name` | `author` (string or object) |
| `repository` | (top-level git remote) |
| `keywords` | (not standard) |
| `license` | (not standard, use LICENSE file) |

## Keeping Both Versions in Sync

1. **Develop in your preferred format** (Claude Code or OpenCode)
2. **Run sync mode** after each change: `plugin-convert sync --source ./my-plugin --target ./my-plugin-opencode`
3. **CI/CD integration**: Add a sync workflow that converts on every push
4. **Validate both**: Run validation on both versions in CI

The sync state is tracked in `.plugin-sync-state.json` in the target directory.
