# Research: Claude Code Plugin Structure for Skill Migration to nsheaps/.ai

**Researcher**: Road Runner (Deep Researcher)
**Date**: 2026-02-17
**Question**: How should the agent-teams skill be structured as a plugin in the nsheaps/.ai repo? What's the correct directory layout, how do other repos reference/install it, can a plugin contain just a skill, and is there versioning/pinning?

## Answer

**Yes, a plugin can contain just a skill** — several existing plugins in nsheaps/.ai already do this (e.g., `product-development-and-sdlc`, `github-auth-skill`). The migration is straightforward: create a new directory under `plugins/agent-teams/` with a `.claude-plugin/plugin.json` manifest and a `skills/agent-teams/SKILL.md` file, then add a marketplace entry. No hooks, commands, agents, or MCP servers are required.

## 1. Plugin Directory Structure in nsheaps/.ai

### How nsheaps/.ai Is Organized

nsheaps/.ai is a **plugin marketplace** repo, not a single plugin. Its structure:

```
nsheaps/.ai/
├── .claude-plugin/
│   └── marketplace.json          ← Marketplace catalog (lists all plugins)
├── plugins/
│   ├── scm-utils/                ← Plugin with skills + commands
│   ├── git-spice/                ← Plugin with skills + scripts
│   ├── product-development-and-sdlc/  ← Skill-only plugin
│   ├── github-auth-skill/        ← Skill-only plugin
│   └── ... (26 plugins total)
├── .ai/                          ← Rules, agents, commands, docs (non-plugin)
└── .claude/                      ← Hooks, MCP, skills, settings (non-plugin)
```

### Correct Structure for agent-teams Plugin

Based on the existing patterns in nsheaps/.ai (scm-utils, git-spice, product-development-and-sdlc):

```
plugins/agent-teams/
├── .claude-plugin/
│   └── plugin.json               ← Manifest (only `name` is required)
├── skills/
│   └── agent-teams/
│       ├── SKILL.md              ← Main skill content
│       └── references/           ← Supporting reference files
│           ├── launch-patterns.md
│           └── hooks-reference.md
├── README.md                     ← Plugin description
└── .release-it.js                ← Release automation (existing pattern)
```

### Concrete plugin.json for agent-teams

Following the exact pattern of existing plugins:

```json
{
  "name": "agent-teams",
  "version": "0.1.0",
  "description": "Comprehensive reference for Claude Code agent teams — spawning teammates, configuring tmux mode, hooks, and multi-agent orchestration",
  "author": {
    "name": "Nathan Heaps",
    "email": "nsheaps@gmail.com",
    "url": "https://github.com/nsheaps"
  },
  "homepage": "https://github.com/nsheaps/.ai/tree/main/plugins/agent-teams",
  "repository": "https://github.com/nsheaps/.ai",
  "keywords": [
    "agent-teams",
    "teammates",
    "tmux",
    "orchestration",
    "multi-agent",
    "swarm",
    "hooks",
    "delegate"
  ]
}
```

### Marketplace Entry to Add

Add to `.claude-plugin/marketplace.json` in the `plugins` array:

```json
{
  "name": "agent-teams",
  "description": "Comprehensive reference for Claude Code agent teams — spawning teammates, configuring tmux mode, hooks, and multi-agent orchestration",
  "version": "0.1.0",
  "author": {
    "name": "Nathan Heaps"
  },
  "source": "./plugins/agent-teams",
  "category": "utility",
  "tags": ["utility", "skill"],
  "keywords": [
    "agent-teams",
    "teammates",
    "tmux",
    "orchestration",
    "multi-agent",
    "swarm",
    "hooks"
  ]
}
```

**Confidence**: High — directly matches existing patterns in 26 other plugins in the same repo.

## 2. How Other Repos Reference/Install a Plugin via Settings

### Plugin Reference Format

Plugins are referenced as `plugin-name@marketplace-name` in settings files.

For nsheaps/.ai, the marketplace name is derived from the repo. When added via:
```bash
/plugin marketplace add nsheaps/.ai
```

The marketplace name becomes something like `nsheaps-ai` (derived from `owner-repo`). The actual marketplace name is set by the `name` field in `marketplace.json` — currently `"nsheaps-claude-plugins"`.

### Settings File Format

Plugins are enabled in `enabledPlugins` in settings.json:

```json
{
  "enabledPlugins": {
    "agent-teams@nsheaps-claude-plugins": true
  }
}
```

**Note**: The current claude-utils `.claude/settings.json` already has:
```json
{
  "enabledPlugins": {
    "plugin-dev@claude-plugins-official": true
  }
}
```

This shows the format is `{ "plugin-name@marketplace-name": true }` (object format, not array — the docs show array format but the actual implementation uses object format with boolean values).

### Installation Scopes

| Scope | File | Use Case |
|:------|:-----|:---------|
| `user` | `~/.claude/settings.json` | Personal, all projects (default) |
| `project` | `.claude/settings.json` | Team, shared via git |
| `local` | `.claude/settings.local.json` | Personal, this project only |

### CLI Installation

```bash
# User scope (default)
claude plugin install agent-teams@nsheaps-claude-plugins

# Project scope
claude plugin install agent-teams@nsheaps-claude-plugins --scope project

# Interactive (choose scope)
/plugin   # → Discover tab → select agent-teams
```

### Team Auto-Installation

To have a project automatically suggest installing the marketplace + plugin:

```json
// .claude/settings.json in the consuming project
{
  "extraKnownMarketplaces": [
    {
      "source": "nsheaps/.ai",
      "autoUpdate": true
    }
  ],
  "enabledPlugins": {
    "agent-teams@nsheaps-claude-plugins": true
  }
}
```

**Confidence**: High — verified from official docs and existing settings.json in claude-utils.

## 3. Can a Plugin Contain Just a Skill?

**Yes.** Multiple existing plugins in nsheaps/.ai contain only a skill:

| Plugin | Components |
|:-------|:-----------|
| `product-development-and-sdlc` | Only `skills/prd-writing/SKILL.md` + references |
| `github-auth-skill` | Only `skills/auth-user/SKILL.md` |
| `memory-manager` | Only skill |
| `self-terminate` | Only skill |

The manifest is even **optional** — Claude Code auto-discovers components in default locations. But including it is best practice for metadata and marketplace listing.

A skill-only plugin needs at minimum:
```
my-plugin/
├── .claude-plugin/
│   └── plugin.json      ← {"name": "my-plugin"}
└── skills/
    └── my-skill/
        └── SKILL.md
```

**Confidence**: High — verified against 4+ existing skill-only plugins in the same repo.

## 4. Versioning and Pinning

### Version Management

- Version can be set in `plugin.json`, `marketplace.json`, or both
- If both set, `plugin.json` takes priority
- Follows semver: `MAJOR.MINOR.PATCH`

### How Updates Work

- Claude Code copies marketplace plugins to `~/.claude/plugins/cache`
- Version comparison determines whether to update
- **If you change code but don't bump version, users won't see changes** (cache prevents it)

### Pinning

**There is no explicit version pinning mechanism.** The `enabledPlugins` format is:
```
"plugin-name@marketplace-name": true
```

There's no `@version` syntax — you always get the latest version from the marketplace.

**Workaround for pinning**: Use a Git ref when adding the marketplace:
```bash
/plugin marketplace add https://github.com/nsheaps/.ai.git#v1.0.0
```

This pins the entire marketplace (all plugins) to a specific tag/branch.

### Auto-Updates

- Official Anthropic marketplaces: auto-update ON by default
- Third-party marketplaces: auto-update OFF by default
- Controllable per-marketplace via `/plugin` UI
- Global disable: `DISABLE_AUTOUPDATER=true`
- Plugins-only updates: `FORCE_AUTOUPDATE_PLUGINS=true` + `DISABLE_AUTOUPDATER=true`

**Confidence**: High — verified from official docs.

## 5. Plugin Caching and Path Limitations

### Important for Migration

Plugins installed from marketplaces are **copied to cache** (`~/.claude/plugins/cache`), not used in-place. This means:

- **No path traversal**: `../shared-utils` won't work after installation
- **Self-contained**: All files the plugin needs must be within its directory
- **Symlinks honored**: If the plugin contains symlinks, the symlinked content is copied into the cache

### Implications for agent-teams

The current agent-teams skill in claude-utils lives at `.claude/skills/agent-teams/SKILL.md` with `references/` subdirectory. When migrated:

1. All reference files must be **within** `plugins/agent-teams/skills/agent-teams/references/`
2. Scripts (if any) must be within the plugin directory
3. Cannot reference files from the parent nsheaps/.ai repo or claude-utils

**Confidence**: High — official docs explicitly state this limitation.

## 6. Component Namespacing

After installation, the skill will be accessible as:
- `/agent-teams:agent-teams` (fully qualified: `plugin-name:skill-name`)
- Claude may also invoke it automatically based on context

Since the plugin name and skill name are both `agent-teams`, the qualified name is `agent-teams:agent-teams`. This is consistent with patterns like `scm-utils:commit`.

**Confidence**: High — verified from docs on component namespacing.

## Migration Checklist

1. [ ] Create `plugins/agent-teams/` directory in nsheaps/.ai
2. [ ] Create `.claude-plugin/plugin.json` with manifest
3. [ ] Create `skills/agent-teams/SKILL.md` (copy from claude-utils)
4. [ ] Copy `skills/agent-teams/references/` (all reference files)
5. [ ] Create `README.md` for the plugin
6. [ ] Add `.release-it.js` (follow existing plugin pattern)
7. [ ] Add marketplace entry to `.claude-plugin/marketplace.json`
8. [ ] Test: `claude --plugin-dir ./plugins/agent-teams` (local test)
9. [ ] Test: `/plugin marketplace update` after push
10. [ ] Remove old skill from claude-utils `.claude/skills/agent-teams/`
11. [ ] Add `enabledPlugins` reference in claude-utils `.claude/settings.json`

## Open Questions

1. **Should the plugin name be `agent-teams` or `claude-team`?** The skill is currently called `agent-teams` but the new repo is `claude-team`. Need user decision on naming.
2. **Should the skill content be updated before or during migration?** The current SKILL.md references claude-utils paths. It needs updating to be repo-agnostic.
3. **Does the `.release-it.js` pattern need to be followed?** Every plugin in nsheaps/.ai has one, but its contents and necessity are unclear.

## Confidence Levels

| Finding | Confidence |
|:--------|:-----------|
| Skill-only plugins are valid and common | High |
| Plugin directory structure follows `plugins/<name>/` pattern | High |
| `plugin.json` only requires `name` field | High |
| Marketplace entry format matches existing 26 plugins | High |
| `enabledPlugins` uses `plugin-name@marketplace-name` format | High |
| No explicit version pinning (only marketplace-level git ref) | High |
| Plugin cache copies prevent path traversal outside plugin dir | High |
| Qualified skill name will be `agent-teams:agent-teams` | High |
| Object format `{ "name": true }` vs array format for enabledPlugins | Medium-High (observed in practice vs docs) |

## Sources

- [Claude Code Plugins Reference](https://code.claude.com/docs/en/plugins-reference) — manifest schema, component locations, CLI commands
- [Claude Code Discover & Install Plugins](https://code.claude.com/docs/en/discover-plugins) — marketplace management, installation scopes, auto-updates
- [Claude Code Plugin Marketplaces](https://code.claude.com/docs/en/plugin-marketplaces) — marketplace.json format, distribution
- nsheaps/.ai repo: `.claude-plugin/marketplace.json` — 26 plugin entries with source paths
- nsheaps/.ai repo: `plugins/scm-utils/.claude-plugin/plugin.json` — real manifest example
- nsheaps/.ai repo: `plugins/git-spice/.claude-plugin/plugin.json` — real manifest example
- nsheaps/.ai repo: `plugins/product-development-and-sdlc/` — skill-only plugin example
- claude-utils: `.claude/settings.json` — existing enabledPlugins format
