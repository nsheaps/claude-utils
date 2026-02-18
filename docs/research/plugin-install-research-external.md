# Research: Plugin Installation & Management — External Sources

**Researcher**: Road Runner (Deep Researcher)
**Date**: 2026-02-18

## 1. Installation Methods

### Method A: Marketplace Installation (Primary)

Install from a marketplace using the `/plugin` command or CLI:

```bash
# Interactive UI
/plugin install plugin-name@marketplace-name

# CLI with scope
claude plugin install formatter@my-marketplace --scope project
```

Three installation scopes control where the plugin entry is written:

| Scope     | Settings File                 | Shared? |
|-----------|-------------------------------|---------|
| `user`    | `~/.claude/settings.json`     | No (personal, all projects) |
| `project` | `.claude/settings.json`       | Yes (version controlled) |
| `local`   | `.claude/settings.local.json` | No (gitignored) |
| `managed` | `managed-settings.json`       | Admin-controlled, read-only |

Plugin entries are stored in the `enabledPlugins` key of the relevant settings file:

```json
{
  "enabledPlugins": {
    "code-formatter@team-tools": true,
    "deployment-tools@team-tools": true
  }
}
```

**Source**: [Official docs — Discover and install plugins](https://code.claude.com/docs/en/discover-plugins), [Plugins reference](https://code.claude.com/docs/en/plugins-reference)

### Method B: `--plugin-dir` Flag (Development/Testing)

Load a plugin directly from a local directory for the duration of a session:

```bash
claude --plugin-dir ./my-plugin
# Multiple plugins:
claude --plugin-dir ./plugin-one --plugin-dir ./plugin-two
```

This does NOT install the plugin — it loads it for the current session only. No entry is written to settings.json.

**Source**: [Official docs — Create plugins](https://code.claude.com/docs/en/plugins)

### Method C: Team/Project Marketplace Configuration

Admins can configure automatic marketplace and plugin installation via `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "acme-tools": {
      "source": { "source": "github", "repo": "acme-corp/claude-plugins" }
    }
  },
  "enabledPlugins": {
    "plugin-name@acme-tools": true
  }
}
```

Team members are prompted to install these when they trust the repository folder.

**Source**: [Official docs — Settings](https://code.claude.com/docs/en/settings)

### Plugin Caching

Marketplace-installed plugins are copied to `~/.claude/plugins/cache/` rather than used in-place. This is a security measure. Plugins loaded via `--plugin-dir` are used directly from the specified path.

**Source**: [Official docs — Plugins reference](https://code.claude.com/docs/en/plugins-reference)

## 2. Update Mechanisms

### Manual Update

```bash
claude plugin update plugin-name@marketplace-name --scope user
```

### Auto-Update

Marketplaces can have auto-update enabled. When enabled, Claude Code refreshes marketplace data and updates installed plugins at startup. If plugins were updated, a notification suggests restarting.

- Official Anthropic marketplaces: auto-update **enabled** by default
- Third-party/local marketplaces: auto-update **disabled** by default

Toggle via `/plugin` > Marketplaces tab > select marketplace > Enable/Disable auto-update.

### Environment Variables

| Variable | Effect |
|----------|--------|
| `DISABLE_AUTOUPDATER` | Disables ALL auto-updates (Claude Code + plugins) |
| `FORCE_AUTOUPDATE_PLUGINS=true` | Keeps plugin auto-updates even when `DISABLE_AUTOUPDATER` is set |

### Version Bumps

Plugin version in `plugin.json` determines whether an update is detected. If code changes but version stays the same, users will NOT see updates due to caching.

**Source**: [Official docs — Discover and install plugins](https://code.claude.com/docs/en/discover-plugins), [Plugins reference](https://code.claude.com/docs/en/plugins-reference)

### Known Bug: Hook Paths After Update

When a plugin with hooks is updated, the `${CLAUDE_PLUGIN_ROOT}` expansion in `settings.json` retains the OLD versioned path (e.g., `~/.claude/plugins/cache/.../2.2.1/scripts/...`), causing hooks to fail when the old cache directory is cleaned. The `installed_plugins.json` updates correctly but `settings.json` hook entries do not.

**Source**: [GitHub Issue #18517](https://github.com/anthropics/claude-code/issues/18517)

## 3. Restart Requirements

### Requires Restart (or did, until recent versions)

| Component | Restart Required? | Notes |
|-----------|-------------------|-------|
| Plugin install (pre-2.1.45) | **Yes** | Plugins loaded at session startup only |
| Plugin install (2.1.45+) | **No** | Commands, agents, and hooks available immediately after install |
| Plugin uninstall | **Likely yes** | No specific docs on uninstall hot-reload |
| Plugin enable/disable | **Unclear** | Not explicitly documented; likely requires restart |
| Hook configuration changes | **Yes** | [Issue #22679](https://github.com/anthropics/claude-code/issues/22679) confirms hooks are cached |
| MCP server config changes | **Yes** | [Issue #24057](https://github.com/anthropics/claude-code/issues/24057) — MCP servers don't auto-reload |
| Agent definitions (in plugins) | **Previously yes** | Closed as NOT_PLANNED in [Issue #6497](https://github.com/anthropics/claude-code/issues/6497); may now be fixed by 2.1.45 for plugin agents |

**Source**: [Official changelog](https://code.claude.com/docs/en/changelog) (v2.1.45 entry), [GitHub Issue #18174](https://github.com/anthropics/claude-code/issues/18174), [GitHub Issue #6497](https://github.com/anthropics/claude-code/issues/6497)

### Does NOT Require Restart

| Component | Hot-Reload? | Since Version | Notes |
|-----------|-------------|---------------|-------|
| Skills (standalone `.claude/skills/`) | **Yes** | v2.1.0 | Immediate on file save |
| Skills (via `--add-dir`) | **Yes** | v2.1.32 | Auto-loaded from additional directories |
| Settings changes on disk | **Partial** | v1.0.90+ | Permission rules refresh; unclear about all settings |
| CLAUDE.md files | **Read at startup** | Always | Re-read on compaction/continue; `--add-dir` support in v2.1.20 |
| Rules files (`.claude/rules/`) | **Read at startup** | Always | Similar to CLAUDE.md — loaded per-conversation-turn from disk |
| Plugin-provided commands/agents/hooks | **Yes** | v2.1.45 | Available immediately after `/plugin install` |

**Source**: [Claude Code 2.1.0 announcement](https://www.threads.com/@boris_cherny/post/DTOyRyBD018), [Official changelog](https://code.claude.com/docs/en/changelog), [ClaudeLog FAQ](https://claudelog.com/faqs/what-is-skill-hot-reload-in-claude-code/)

## 4. Hot-Reload Behavior

### Skills Hot-Reload (v2.1.0+)

Skills in `~/.claude/skills/` and `.claude/skills/` are monitored for changes. When you save modifications to a skill's `SKILL.md`, the updated skill becomes accessible in the active session without restart.

This was announced as part of Claude Code 2.1.0: "Skills: forked context, hot reload, custom agent support, invoke with /"

**Source**: [Claude Code 2.1.0 release](https://www.threads.com/@boris_cherny/post/DTOyRyBD018), [ClaudeLog](https://claudelog.com/faqs/what-is-skill-hot-reload-in-claude-code/)

### Settings Hot-Reload (v1.0.90+)

Settings hot-reload was added in v1.0.90. The exact scope of what reloads is not fully documented, but stale permission rules are refreshed when settings change on disk (confirmed fix in v2.1.20).

**Source**: [GitHub Issue #6497](https://github.com/anthropics/claude-code/issues/6497) (references 1.0.90 settings hot-reload), [Official changelog](https://code.claude.com/docs/en/changelog)

### Plugin Installation Hot-Reload (v2.1.45+)

As of v2.1.45, plugin-provided commands, agents, and hooks are available immediately after installation without restart. This is the most recent and significant improvement.

**Source**: [Official changelog](https://code.claude.com/docs/en/changelog)

### What Still Does NOT Hot-Reload

- MCP server configuration changes ([Issue #24057](https://github.com/anthropics/claude-code/issues/24057))
- Hook configuration changes in settings.json ([Issue #22679](https://github.com/anthropics/claude-code/issues/22679))
- Plugin code changes during development (for `--plugin-dir` loaded plugins — docs say "restart Claude Code to pick up the updates")
- Agent file changes for standalone agents (closed NOT_PLANNED in [Issue #6497](https://github.com/anthropics/claude-code/issues/6497))
- CLAUDE.md is not reloaded after context compaction ([Issue #22085](https://github.com/anthropics/claude-code/issues/22085))

**Source**: Various GitHub issues linked above

## 5. Verification Methods

### Check `/plugin` UI

Run `/plugin` within Claude Code to open the plugin manager:
- **Installed** tab: shows installed plugins grouped by scope
- **Errors** tab: shows plugin loading errors (invalid manifests, missing binaries, etc.)

### Debug Mode

```bash
claude --debug
# or within TUI:
/debug
```

Debug mode shows:
- Which plugins are being loaded
- Errors in plugin manifests
- Command, agent, and hook registration
- MCP server initialization

### Validate Plugin Manifest

```bash
claude plugin validate
# or within TUI:
/plugin validate
```

### Check Plugin Cache

Installed plugins are cached at `~/.claude/plugins/cache/`. Clearing this cache and reinstalling can resolve issues:

```bash
rm -rf ~/.claude/plugins/cache
# Then restart and reinstall
```

### Verify Skills Are Loaded

Run `/help` to see all available commands. Plugin skills appear namespaced as `/plugin-name:skill-name`.

**Source**: [Official docs — Plugins reference (Debugging section)](https://code.claude.com/docs/en/plugins-reference)

## Open Questions

1. **Does `--plugin-dir` hot-reload file changes?** The docs say "restart Claude Code to pick up the updates" when developing with `--plugin-dir`, but this may have changed with 2.1.45's improvements. Needs testing.

2. **Does disabling/enabling a plugin take effect immediately?** Not documented. The 2.1.45 fix only mentions "installation" — enable/disable may still need restart.

3. **Do standalone agent files (`.claude/agents/`) hot-reload?** Issue #6497 was closed NOT_PLANNED, but the 2.1.0 announcement and 2.1.45 fix may have implicitly resolved this. Needs testing.

4. **Exact scope of settings hot-reload**: We know permission rules refresh, but do ALL settings changes take effect immediately? The docs are vague.

5. **Do rules files (`.claude/rules/*.md`) hot-reload?** These are likely re-read each conversation turn (similar to CLAUDE.md), but this is inference, not confirmed.

6. **Does updating a plugin via `claude plugin update` require restart post-2.1.45?** Only "installation" is mentioned in the fix — updates may behave differently.

7. **MCP server reload timeline**: Issue #24057 requests auto-reload for MCP servers — no official timeline or response found.

## Sources

- [Official docs — Create plugins](https://code.claude.com/docs/en/plugins)
- [Official docs — Discover and install plugins](https://code.claude.com/docs/en/discover-plugins)
- [Official docs — Plugins reference](https://code.claude.com/docs/en/plugins-reference)
- [Official docs — Settings](https://code.claude.com/docs/en/settings)
- [Official changelog](https://code.claude.com/docs/en/changelog)
- [Claude Code 2.1.0 release announcement (Threads)](https://www.threads.com/@boris_cherny/post/DTOyRyBD018)
- [ClaudeLog — Skill Hot-Reload FAQ](https://claudelog.com/faqs/what-is-skill-hot-reload-in-claude-code/)
- [GitHub Issue #18174 — Support hot-reload for plugins without session restart](https://github.com/anthropics/claude-code/issues/18174) (OPEN/stale)
- [GitHub Issue #6497 — Hot reload of agents and slash commands](https://github.com/anthropics/claude-code/issues/6497) (CLOSED, NOT_PLANNED)
- [GitHub Issue #18517 — Plugin hooks version path not updated](https://github.com/anthropics/claude-code/issues/18517) (OPEN)
- [GitHub Issue #20507 — Add /reload-skills command](https://github.com/anthropics/claude-code/issues/20507) (CLOSED as duplicate)
- [GitHub Issue #22085 — Auto-reload CLAUDE.md after compaction](https://github.com/anthropics/claude-code/issues/22085) (OPEN)
- [GitHub Issue #22679 — Hook settings cached, changes don't take effect](https://github.com/anthropics/claude-code/issues/22679) (referenced)
- [GitHub Issue #24057 — MCP servers, hooks, plugins should auto-reload](https://github.com/anthropics/claude-code/issues/24057) (referenced)
- [GitHub Issue #20390 — Plugin install reports "already installed" across projects](https://github.com/anthropics/claude-code/issues/20390) (OPEN)
- [GitHub Issue #11240 — Plugin lifecycle hooks: install and uninstall](https://github.com/anthropics/claude-code/issues/11240) (OPEN)
