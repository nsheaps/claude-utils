# Source Analysis: Plugin Loading & Hot-Reload Behavior

**Source**: Decompiled Claude Code v2.0.74 (`claude-renamed.js`, 532k+ lines)
**Date**: 2026-02-18

## Plugin Loading Mechanism

Plugins are loaded via the memoized function `n$` (line 223352), which:
1. Calls `UL7()` to load installed plugins from disk
2. Loads session-only plugins from `--plugin-dir` flag via `FL7()`
3. Filters into enabled vs disabled lists
4. Returns `{ enabled, disabled, errors }`

`n$` is wrapped with `HA` (lodash `memoize`, line 524), meaning it caches its result and only re-executes when the cache is explicitly cleared.

**Cache invalidation** happens via `Mo()` (line 223332-223333):
```js
function Mo() {
  n$.cache?.clear?.();
}
```

`Mo()` is called by:
- `IL7()` / `Qq()` — the master "invalidate all plugin caches" functions (line 222252-222257)
- Direct calls when plugins are installed (line 365580), enabled, or marketplace updated (line 418749)
- Settings changes for `policySettings` (line 222114)

`Qq()` (line 222255-222257) calls `IL7()` + `xi_()`, and is invoked from:
- Plugin install/uninstall/enable/disable operations (lines 364964, 365027, 365072, 391033-391058)
- Marketplace operations (lines 395406, 395613, 396390, 396850)
- Plugin management UI interactions (lines 397572, 397646)
- CLI `plugin` subcommands (lines 419653, 419681, 419691, 419697)

`IL7()` clears multiple caches: `Mo()` (plugins), `y3R()`, `wi_()`, `p5A()` (hooks cache), `i5A()`.

**Plugin manifest**: Read from `.claude-plugin/plugin.json` or legacy `plugin.json` at the plugin's install path (line 222646-222688). This is a synchronous file read at load time, not watched.

**Installed plugins state**: Stored in `installed_plugins.json` (V2 format) at `~/.claude/plugins/installed_plugins.json` (line 207520). Synced with `enabledPlugins` from all `settings.json` files (line 207803).

## File Watching / Hot-Reload

### Settings Files — Watched via Chokidar

Claude Code uses **chokidar** (line 136856) to watch settings files. The watcher is set up in `rMD()` (line 137258-137276):

```js
v(`Watching for changes in setting files ${toolLinuxDef.join(", ")}...`);
w6T = KC_.watch(toolLinuxDef, {
  persistent: true,
  ignoreInitial: true,
  depth: 0,
  awaitWriteFinish: {
    stabilityThreshold: 1000,  // default (line 137328)
    pollInterval: 500           // default (line 137329)
  },
  ignored: path => path.split(sep).some(s => s === ".git"),
  ignorePermissionErrors: true,
  usePolling: false,
  atomic: true
});
w6T.on("change", eMD);
w6T.on("unlink", TjD);
```

Settings being watched (line 137256, 137290-137301):
- `userSettings` — `~/.claude/settings.json`
- `projectSettings` — `.claude/settings.json`
- `localSettings` — `.claude/settings.local.json`
- `flagSettings`
- `policySettings`

The watch watches the **directories** containing these files (at depth 0), not the files themselves.

On change detection (line 137303-137311):
1. Identifies which settings scope changed
2. Checks for self-write debounce (skips if Claude itself wrote the file recently)
3. Notifies all subscribers via a callback set (`b6T`)

### Settings Change Propagation (zZ event bus)

The settings change bus `zZ` has:
- `subscribe(callback)` — registers listeners
- `notifyChange(scope)` — triggers listeners with scope name
- `initialize()` — sets up the system (line 413525)

Subscribers react to settings changes:
- **Sandbox config** (line 142977-142981): Updates sandbox configuration on any settings change
- **Plugin hooks** (line 222113-222114): When `policySettings` changes, clears plugin cache (`Mo()`), clears hook cache (`p5A()`), and reloads hooks (`So()`)
- **Remote settings polling** (line 269739-269755): Notifies `policySettings` change when remote settings are fetched/changed

### What Is NOT Watched

- **Plugin directories** — No file watcher on plugin install paths
- **CLAUDE.md files** — Not watched; re-read via memoized function with explicit cache clearing
- **Skill files (SKILL.md)** — Not watched
- **MCP config (.mcp.json)** — Not watched at runtime
- **Hook files** — Not watched directly (reloaded when plugin cache is invalidated)

### CLAUDE.md Remote File Watch

There is one additional `fs.watch` call (line 270199) that watches a path related to remote settings JSON, triggering a refresh every 5 seconds (`gc7 = 5000`, line 270215). This appears to be for the remote/managed settings file, not user CLAUDE.md.

## Settings Reload Behavior

Settings files (`settings.json`) are the **only** files hot-reloaded via file watching.

When a settings file changes:
1. Chokidar detects the change
2. `eMD()` handler fires (line 137303)
3. Self-write debounce check (line 137307-137309)
4. All registered subscribers in `b6T` are notified
5. `zZ.notifyChange()` propagates to system components

Programmatic writes by Claude Code call `sMD()` (line 137286-137289) to register a timestamp, so the watcher ignores its own writes. Line 411035 confirms: `zZ.markInternalWrite(toolLinuxDef)` before writing settings.

## MCP Server Reload

MCP servers are configured in:
- `.mcp.json` at project root (line 223449)
- `settings.json` under `mcpServers` key (line 206058)
- Plugin manifests under `mcpServers` (line 221320)

**No hot-reload for MCP servers.** The `.mcp.json` file is in the `UVT` array of known dotfiles (line 138151) but is NOT in the watched settings files list. MCP servers are loaded at startup and when plugins are loaded/refreshed.

MCP server connections are established via transport (SSE, stdio, WebSocket) and maintained as persistent connections. Server approval/rejection is prompted on first use. There is no mechanism to detect changes to `.mcp.json` at runtime.

Plugin-provided MCP servers are (re)loaded when `Qq()` invalidates plugin caches and the plugin system reloads.

## Hook Loading

Hooks are loaded via the memoized function `So` (line 222129):

```js
So = HA(async () => {
  let { enabled: toolLinuxDef } = await n$(),  // gets enabled plugins
    errorHandler_R = {
      PreToolUse: [], PostToolUse: [], PostToolUseFailure: [],
      Notification: [], UserPromptSubmit: [],
      SessionStart: [], SessionEnd: [], Stop: [],
      SubagentStart: [], SubagentStop: [],
      PreCompact: [], PermissionRequest: []
    };
  for (let _ of toolLinuxDef) {
    if (!_.hooksConfig) continue;
    v(`Loading hooks from plugin: ${_.name}`);
    // ... loads hook configs from each plugin
  }
});
```

Hooks are loaded from:
1. Plugin `hooksConfig` (from `plugin.json` manifest or marketplace entry)
2. Settings-defined hooks (from `settings.json`)

Hook cache is cleared by `p5A()` (line 222108-222110):
```js
function p5A() {
  So.cache?.clear?.();
}
```

This is called by:
- `IL7()` — master cache invalidation (line 222253)
- Settings changes for `policySettings` (line 222114)

**Hooks are NOT watched directly.** They reload when:
1. Plugin cache is invalidated (plugin install/enable/disable)
2. Policy settings change (remote config update)
3. The `/clear` or `/compact` commands reset state

Hook loading errors are reported as `hook-load-failed` events (lines 222873-222939).

## Skill/Rule Loading

### Skills

Skills are loaded via `XkA` (line 390049), also memoized with `HA`:

```js
XkA = HA(async toolLinuxDef => {
  let errorHandler_R = j5.join(M9(), "skills"),          // managed skills
      errorHandler_A = j5.join(oY(), ".claude", "skills"), // user skills
      _ = abA("skills", toolLinuxDef);                     // project skills
  v(`Loading skills from: managed=${errorHandler_A}, user=${errorHandler_R}, project=[...]`);
  // ... loads SKILL.md from each directory
});
```

Skills are loaded from:
- Managed settings directory (policy-controlled)
- User settings `~/.claude/skills/`
- Project `.claude/skills/` directories
- Plugin skill paths

Cache cleared at line 390033: `XkA.cache?.clear?.()` — called alongside `Jd.cache?.clear?.()`.

Plugin skills are loaded separately via `PZ1()` which depends on `n$()` (the plugin cache).

**Skills are NOT file-watched.** They are re-read when:
1. The skill cache is explicitly cleared
2. After `/clear` or `/compact` (line 376944)
3. When plugins are refreshed via `Qq()`

Skills use inode-based deduplication (line 390064-390073) to handle symlinks.

### CLAUDE.md / Rules

CLAUDE.md content is loaded via `V2` (line 238955), memoized with `HA`:
- Reads `CLAUDE.md`, `.claude/CLAUDE.md`, `CLAUDE.local.md`
- Reads `.claude/rules/*.md` files
- Reads managed and user-level equivalents

`V2.cache` is cleared in these contexts:
- `/clear` command (line 376944)
- `/compact` command (lines 377025, 377038)

**CLAUDE.md and rules files are NOT file-watched.** They are re-read from disk only when:
1. Cache is cleared by `/clear` or `/compact`
2. A new conversation starts (cache is fresh)

This means **edits to CLAUDE.md or rule files mid-session will NOT be picked up until compaction or /clear**.

The content feeds into `K5` (line 285211), also memoized, which is the function that builds the system prompt section for CLAUDE.md content. `K5.cache` is cleared alongside `V2.cache`.

## Summary: What Needs Restart vs What's Hot

| Component | Hot-Reload? | Mechanism | Evidence |
|:----------|:-----------|:----------|:---------|
| `settings.json` | **Yes** — file-watched | Chokidar watcher + event bus (`zZ`) | Lines 137258-137275, 137303-137317 |
| Plugin list (enable/disable) | **Yes** — on settings change | `policySettings` change triggers `Mo()` cache clear | Line 222114 |
| Plugin install/uninstall | **Yes** — immediate | `Qq()` clears all caches after install | Lines 365580, 391047 |
| Plugin code/manifest changes | **No** — requires reinstall | Only read at install time, cached via `HA` | Lines 222646-222688 |
| Hook configs | **Partial** — on plugin reload | Cleared when `p5A()` called via `IL7()` | Lines 222108-222114 |
| Hook files on disk | **No** — not watched | Only read when hook cache is invalidated | Lines 222873-222939 |
| MCP servers (.mcp.json) | **No** — startup only | Read once, connections persist | Lines 223449, 223728 |
| MCP servers (settings.json) | **No** — not re-established | Config may update but connections aren't restarted | Line 206058 |
| MCP servers (plugin) | **Partial** — on plugin reload | Re-read when `Qq()` invalidates plugin cache | Lines 221320, 397350 |
| CLAUDE.md / rules | **No** — cached | Re-read only on `/clear` or `/compact` | Lines 238955, 376944, 377025, 377038 |
| Skills (SKILL.md) | **No** — cached | Re-read on `/clear`, `/compact`, or plugin refresh | Lines 390033, 390049-390078 |
| Sandbox config | **Yes** — on settings change | `zZ.subscribe()` updates config | Lines 142977-142981 |
| Remote/policy settings | **Yes** — polled | Background polling with 5s refresh, triggers `policySettings` notify | Lines 269739-269755 |

## Confidence Levels

| Finding | Confidence |
|:--------|:-----------|
| Settings.json is file-watched via chokidar | **High** — explicit watcher setup code with clear config |
| CLAUDE.md is NOT watched, only re-read on /clear or /compact | **High** — memoized with `HA`, cache cleared only in specific spots |
| Plugins are memoized and cache-invalidated on install/enable | **High** — clear `Mo()` / `Qq()` pattern |
| MCP servers not hot-reloaded | **High** — no restart mechanism found, .mcp.json not in watch list |
| Hook files not directly watched | **High** — loaded via memoized function, no file watcher setup |
| Skills not directly watched | **High** — same memoization pattern as CLAUDE.md |
| Plugin manifest changes require reinstall | **Medium-High** — manifest read at install time, no re-read mechanism found |
| Remote settings polled in background | **Medium** — polling code visible but exact interval depends on config |

## Key Architectural Pattern

Claude Code uses a consistent pattern for configuration loading:

1. **Memoize with `HA` (lodash memoize)** — Functions like `n$`, `So`, `K5`, `V2`, `XkA` are all memoized
2. **Cache invalidation via `.cache.clear()`** — Explicit cache clearing at specific lifecycle points
3. **Event bus (`zZ`) for settings** — Only `settings.json` files have file watching + event propagation
4. **No general file watching** — Only settings files are watched; everything else relies on cache invalidation at known lifecycle boundaries

The only true "hot-reload" is for `settings.json` files. Everything else requires either:
- An explicit user action (`/clear`, `/compact`)
- A plugin system operation (install, enable, marketplace update)
- A new session
