# QA Report: nsheaps/agent CLI MVP

**QA Engineer**: Daffy Duck (Quality Assurance)
**Date**: 2026-02-18
**Task**: #139
**Repo**: `/Users/nathan.heaps/src/nsheaps/agent` (GitHub: `nsheaps/agent`)

## Files Reviewed

| File | Lines | Purpose |
|------|-------|---------|
| `src/index.ts` | 35 | Entry point — orchestrates config, preflight, launch |
| `src/config/schema.ts` | 34 | TypeScript interfaces for config |
| `src/config/defaults.ts` | 18 | Default config values |
| `src/config/loader.ts` | 193 | CLI arg parsing, YAML loading, config composition |
| `src/launcher.ts` | 27 | Spawns `claude` binary with composed flags |
| `src/preflight/brew-update.ts` | 47 | Homebrew update check with gum confirm |
| `src/preflight/settings-backup.ts` | 84 | Settings.json backup/corruption detection |
| `package.json` | 26 | Project metadata, build scripts |
| `tsconfig.json` | 15 | TypeScript config |
| `mise.toml` | 35 | Task runner config |
| `docs/specs/draft/agent-wrapper.md` | 190 | PRD |
| `dist/agent` | binary | Compiled Bun binary (59.9MB, arm64) |

**Total source**: 438 lines across 7 files.

---

## Check 1: Config Loading from ~/.config/agent/config.yaml

**File**: `src/config/loader.ts:144,152-164`

```typescript
const USER_CONFIG_PATH = "~/.config/agent/config.yaml";
```

The config loader:
1. Starts with `DEFAULT_CONFIG` (structuredClone — good, no mutation)
2. Loads user config from `~/.config/agent/config.yaml` (or `--config <path>`)
3. Loads project config from `.agent.yaml` in cwd
4. Applies CLI overrides

**PASS** — Config path is correct, loading logic is sound. Uses `expandTilde()` for `~` expansion.

---

## Check 2: Config Composition Order

**PRD specifies**: defaults < base profile < MCP overlays < project config < user config < CLI flags

**Implementation**: defaults < user config < project config < CLI flags

### AGT-1: Composition order differs from PRD (MEDIUM)

**File**: `src/config/loader.ts:5,150-181`

The comment says: `defaults < user (~/.config/agent/config.yaml) < project (.agent.yaml) < CLI flags`

But the PRD says: `defaults < base profile < MCP overlays < project config < user config < CLI flags`

Two differences:
1. **User config before project config** (code) vs **project config before user config** (PRD) — these are swapped
2. **No base profile or MCP overlay layers** — these aren't implemented yet (expected for MVP)

The swap matters: in the PRD, user config wins over project config (user preferences override project defaults). In the code, project config wins over user config (project overrides user preferences).

**Recommendation**: Either:
- Swap the load order in the code so user config loads after project config (matching PRD)
- Or update the PRD if the current order is intentional (project-specific config should override user defaults)

The current order (user < project) is actually defensible — a project's `.agent.yaml` could enforce specific settings. But it contradicts the PRD.

### AGT-2: `deepMerge` array behavior undocumented (LOW)

**File**: `src/config/loader.ts:17`

```typescript
/** Deep merge b into a. Arrays from b replace a entirely. */
```

The comment says arrays from `b` replace `a` entirely. This means if user config has `flags: ["--continue"]` and project config has `flags: ["--resume"]`, the result is `["--resume"]`, not `["--continue", "--resume"]`. This is a design choice but could surprise users — worth documenting in the README or config file comments.

---

## Check 3: Claude Launch Flags (vs bin/run-claude)

**File**: `src/config/defaults.ts:7`
```typescript
flags: ["--allow-dangerously-skip-permissions"],
```

**File**: `bin/lib/claude.lib.sh:76,100` (claude-utils)
```bash
local FLAGS=("--allow-dangerously-skip-permissions" "$@")
```

**PASS** — Both use `--allow-dangerously-skip-permissions`. Flag matches exactly.

**File**: `src/launcher.ts:19`
```typescript
const proc = Bun.spawn(["claude", ...args], {
  stdio: ["inherit", "inherit", "inherit"],
  env: process.env,
});
```

**PASS** — Uses `Bun.spawn` with `stdio: "inherit"` for full terminal passthrough. Passes `process.env` for environment inheritance. Clean and correct.

### AGT-3: No `--continue` in default flags (INFO)

The `run-claude` bash script doesn't include `--continue` as a default flag either — it's a passthrough arg. The `agent` CLI correctly treats unrecognized flags as passthrough to claude (loader.ts:94-97). This is consistent.

### AGT-4: Hardcoded `claude` binary name (LOW)

**File**: `src/launcher.ts:19`
```typescript
const proc = Bun.spawn(["claude", ...args], {
```

The binary name `claude` is hardcoded. In `claude-utils`, there's a preference system (`CLAUDE_PREFERRED_BIN`, `happy` fallback). The `agent` CLI doesn't support this yet.

**Impact**: Low for MVP. But worth noting for parity with the existing launcher behavior.

**Recommendation**: Consider adding a `binary` field to `AgentConfig` (default `"claude"`) for configurability.

---

## Check 4: Build Output and Binary

```
$ file dist/agent
Mach-O 64-bit executable arm64

$ ls -la dist/agent
-rwxr-xr-x 59,967,120 bytes

$ dist/agent --help
agent - Launch Claude Code with managed configuration
...

$ dist/agent --version
agent v0.1.0
```

**PASS** — Binary compiles, runs, and outputs correctly.

### AGT-5: Binary size is ~60MB (INFO)

This is expected for a Bun-compiled binary (Bun bundles its entire runtime). The PRD notes NFR-002 target of <50MB for gs-stack-status, but that spec is for a different project. For `agent`, 60MB is acceptable.

### AGT-6: `dist/` directory committed to git (LOW)

**File**: `.gitignore:310`

The `.gitignore` file doesn't exclude `dist/`. The compiled binary (60MB) is tracked by git.

**Recommendation**: Add `dist/` to `.gitignore` and build in CI instead.

---

## Check 5: PRD Comparison

| PRD Feature | Status | Notes |
|-------------|--------|-------|
| Premade MCP Configs | **NOT IMPLEMENTED** | No MCP config system. Expected for MVP. |
| Settings Management / Profiles | **NOT IMPLEMENTED** | No profile system. Expected for MVP. |
| Agent Launch | **IMPLEMENTED** | `launchClaude()` works correctly |
| Config Composition | **PARTIALLY IMPLEMENTED** | 4 layers work, but order differs from PRD (AGT-1), no profile/MCP layers |
| I/O Proxy | **NOT IMPLEMENTED** | Launcher only, not proxy. Expected for future. |
| Config File Format | **PARTIALLY IMPLEMENTED** | `.agent.yaml` and `~/.config/agent/config.yaml` exist, but only basic fields (flags, brew, settingsBackup) |

This is labeled "MVP" so incomplete PRD coverage is expected. The implemented features work correctly.

---

## Check 6: Code Quality Issues

### AGT-7: Settings backup hooks approach (CAUTION)

**File**: `src/index.ts:21,27`
```typescript
// Preflight: settings backup (pre-launch)
checkSettingsBackup(config.settingsBackup);
// ...
// Post-launch: settings backup check
checkSettingsBackup(config.settingsBackup);
```

Per MEMORY.md: "Settings.json backup hooks approach was REJECTED by user — do not re-attempt."

However, this isn't the hooks approach — it's a pre/post check pattern that runs as part of the `agent` CLI itself, not as Claude Code hooks. This is a different mechanism and may be acceptable. But worth flagging for team lead awareness given the history.

### AGT-8: `import.meta.dir` in printVersion may not work in compiled binary (MEDIUM)

**File**: `src/config/loader.ts:136`
```typescript
const pkg = JSON.parse(
  readFileSync(resolve(import.meta.dir, "../../package.json"), "utf-8"),
);
```

When compiled with `bun build --compile`, `import.meta.dir` resolves to the directory of the compiled binary, not the original source. `../../package.json` relative to `dist/agent` would be `../package.json` at the repo root — but from an installed location (e.g., `/usr/local/bin/agent`), this path won't exist.

The fallback `console.log("agent v0.1.0")` catches this, but version detection won't track actual releases.

**Tested**: `dist/agent --version` outputs `agent v0.1.0` — the fallback works, but it's reading `package.json` from the repo root (since dist/ is inside the repo), not from the compiled binary's embedded path.

**Recommendation**: Embed version at build time:
```json
"build": "bun build src/index.ts --compile --outfile dist/agent --define 'process.env.AGENT_VERSION=\"0.1.0\"'"
```

### AGT-9: `tsconfig.json` references `bun-types` but `@types/bun` is the package name (LOW)

**File**: `tsconfig.json:10`
```json
"types": ["bun-types"]
```

The package is `@types/bun` in `package.json:23`. Bun's TypeScript types are exposed as `bun-types` for the `types` array. This is correct — `@types/bun` exports the `bun-types` type module. Just noting for clarity.

### AGT-10: No tests (INFO)

`mise.toml` has `[tasks.test]` running `bun test`, but there are no test files in the repo. The `test` task will pass (bun test with no files exits 0) but doesn't validate anything.

Expected for an MVP, but the config loading and deepMerge logic would benefit from unit tests.

### AGT-11: License is UNLICENSED (INFO)

**File**: `package.json:10`
```json
"license": "UNLICENSED"
```

But `LICENSE` file exists and says MIT. Package.json should say `"license": "MIT"`.

---

## Positive Findings

- Clean, well-structured TypeScript codebase — 7 files, clear separation of concerns
- `structuredClone` for default config prevents mutation bugs
- `deepMerge` handles nested objects correctly with proper null/array checks
- `expandTilde` properly handles `~` and `~/path` cases
- `parseArgs` correctly handles `--` separator and unrecognized flag passthrough
- `checkBrewUpdates` is fully non-fatal (try/catch, early returns on missing brew/gum)
- `checkSettingsBackup` detects empty files (corruption) and offers restore commands
- `Bun.spawn` with `stdio: "inherit"` gives full terminal passthrough
- Build produces working native binary
- README links to PRD and related repos

---

## Issue Summary

| ID | Severity | Description |
|----|----------|-------------|
| AGT-1 | **MEDIUM** | Config composition order (user < project) differs from PRD (project < user) |
| AGT-8 | **MEDIUM** | `import.meta.dir` version detection won't work in installed binary |
| AGT-4 | LOW | Hardcoded `claude` binary name (no `CLAUDE_PREFERRED_BIN` support) |
| AGT-6 | LOW | `dist/` directory (60MB binary) not in `.gitignore` |
| AGT-2 | LOW | Array replacement behavior in deepMerge undocumented |
| AGT-7 | CAUTION | Settings backup pre/post check — different from rejected hooks approach, but flagging for awareness |
| AGT-11 | INFO | `package.json` says UNLICENSED but LICENSE file says MIT |
| AGT-10 | INFO | No test files (expected for MVP) |
| AGT-9 | INFO | tsconfig `bun-types` vs `@types/bun` naming (correct but confusing) |

**2 MEDIUM, 3 LOW, 1 CAUTION, 3 INFO issues found. No HIGH issues.**

The MVP is clean, well-structured, and functional. The two MEDIUM issues (config order swap and version detection) should be addressed before first release.
