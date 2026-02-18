# claude-team Extraction Analysis

**Author:** Foghorn Leghorn (Ops Engineer)
**Date:** 2026-02-18
**Task:** #38 — Evaluate extracting claude-team into its own repo

---

## Current State

### claude-utils repo scripts (bin/)

| Script | Purpose | Depends on |
|--------|---------|-----------|
| `claude-team` | Agent team launcher (mode picker, tmux, orchestrator prompt) | `lib/claude.lib.sh` → `lib/stdlib.sh` |
| `ct` | Shorthand alias for `claude-team` | `claude-team` |
| `run-claude` | Main entry point with bypass perms, brew update check | `lib/claude.lib.sh` → `lib/stdlib.sh` |
| `ccc` | Continue session shorthand | `run-claude` |
| `ccr` | Resume session shorthand | `run-claude` |
| `cccontinue` | Continue session (verbose alias) | `run-claude` |
| `ccresume` | Resume session (verbose alias) | `run-claude` |
| `cc-newsession` | Create new workspace | standalone |
| `cc-tmp` | Create temp workspace | standalone |
| `cc-resume` | Interactive session picker | standalone (uses fzf) |
| `claude-utils` | Version/help display | `lib/claude.lib.sh` |
| `claude-update` | Brew upgrade shorthand | standalone |
| `claude-clean-orphaned` | Kill orphaned claude procs | standalone |
| `claude-diagnostics` | Diagnostic info collector | standalone |
| `claude-simple-cli` | Minimal Claude CLI for scripting | standalone |
| **lib/stdlib.sh** | Print utils, colors, retry, debounce, path helpers | standalone |
| **lib/claude.lib.sh** | Claude/happy routing, settings backup, version | `lib/stdlib.sh` |

### Dependency Graph

```
claude-team ──→ lib/claude.lib.sh ──→ lib/stdlib.sh
ct ──→ claude-team
run-claude ──→ lib/claude.lib.sh ──→ lib/stdlib.sh
ccc/ccr/cccontinue/ccresume ──→ run-claude
claude-utils ──→ lib/claude.lib.sh
```

### What `claude-team` actually uses from `claude.lib.sh`

- `check_and_install` (from stdlib.sh) — installs gum/tmux via brew
- `info`, `success`, `hint`, `fatal` (from stdlib.sh) — formatted output
- `claude_check_settings_backup` — settings.json backup on entry/exit

It does **NOT** use `claudeish`, `simple_claudeish`, `happy_bin`, or any of the binary routing logic. It calls `claude` directly.

---

## Extraction Options

### Option A: Extract claude-team + ct only (minimal)

**What moves:**
- `bin/claude-team`
- `bin/ct`

**What stays in claude-utils:**
- Everything else, including `lib/stdlib.sh` and `lib/claude.lib.sh`

**Shared dependency problem:**
`claude-team` sources `lib/claude.lib.sh` which sources `lib/stdlib.sh`. If these stay in claude-utils, the extracted repo must either:
1. Copy the lib files (duplication, drift risk)
2. Depend on claude-utils being installed (circular-ish)
3. Inline the few functions it actually needs (fork, but contained)
4. Extract stdlib.sh into a shared package (over-engineering)

**Homebrew implications:**
- New formula: `claude-team.rb` in homebrew-devsetup
- Same release pipeline pattern (release-it → gomplate → PR to tap)
- `claude-team` formula would `depends_on 'gum'` and `depends_on 'tmux'` (optional)
- Need to decide: does `claude-utils` formula still install `claude-team`? Or does it become a separate install?

### Option B: Extract claude-team + ct + stdlib.sh (clean cut)

**What moves:**
- `bin/claude-team`
- `bin/ct`
- `bin/lib/stdlib.sh` (or a copy of it)

**What stays:**
- Everything else in claude-utils
- `lib/claude.lib.sh` (still sources its own copy of stdlib.sh)

**Advantages:**
- `claude-team` is self-contained — no runtime dependency on claude-utils
- stdlib.sh is generic (colors, retry, debounce) — no Claude-specific logic
- Clean install: `brew install claude-team` works independently

**Disadvantages:**
- stdlib.sh exists in two repos — changes must be synced manually
- Or stdlib.sh could become a git submodule / vendored dependency

### Option C: Extract claude-team + ct with inlined dependencies (recommended)

**What moves:**
- `bin/claude-team` (modified to not source external libs)
- `bin/ct`
- `bin/lib/stdlib.sh` (slim copy — only the functions claude-team uses)

**claude-team actually needs these functions from the libs:**
- From `stdlib.sh`: `info`, `success`, `hint`, `fatal`, `error`, `warn`, `check_and_install`
- From `claude.lib.sh`: `claude_check_settings_backup` (and its helpers)

That's ~100 lines of library code. Could be inlined into a single `lib/claude-team.lib.sh` or just kept as a slimmed `stdlib.sh`.

**What stays in claude-utils:**
- All cc-* scripts, run-claude, claude-diagnostics, etc.
- Full stdlib.sh and claude.lib.sh (unchanged)

**Homebrew:**
- New repo: `nsheaps/claude-team`
- New formula: `claude-team.rb`
- `depends_on 'gum'` (required for interactive mode)
- No dependency on claude-utils
- Same release pipeline: release-it + gomplate + auto-PR to homebrew-devsetup
- claude-utils formula removes claude-team and ct from its install

**Manual install:**
```bash
# Clone and symlink
git clone https://github.com/nsheaps/claude-team.git
ln -s $(pwd)/claude-team/bin/claude-team /usr/local/bin/claude-team
ln -s $(pwd)/claude-team/bin/ct /usr/local/bin/ct
```

---

## Recommendation: Option C

**Why:**
1. Clean separation — claude-team is independently installable
2. No runtime dependency on claude-utils
3. Minimal duplication (~100 lines of formatting/install helpers)
4. Users who only want agent teams don't need all of claude-utils
5. Simplest Homebrew setup — no formula dependencies between the two

**Migration steps:**
1. Create `nsheaps/claude-team` repo
2. Copy `claude-team`, `ct`, and a slimmed `lib/` with only needed functions
3. Remove `claude_check_settings_backup` usage OR copy that function too (it's self-contained)
4. Set up release-it + gomplate + auto-PR pipeline (same pattern as claude-utils)
5. Add `claude-team.rb.gotmpl` formula template
6. Remove `claude-team` and `ct` from claude-utils
7. Update claude-utils formula to no longer install those scripts
8. Add note to claude-utils README pointing to claude-team for agent team functionality

**Risk:** Users who have claude-utils installed already get claude-team via `bin.install Dir['bin/*']`. After extraction, they'd need to `brew install claude-team` separately. Should add a deprecation notice or transitional `depends_on` in the claude-utils formula.

---

## Decisions (Resolved 2026-02-18)

All open questions resolved by user via team lead:

1. **claude-utils formula WILL depend on claude-team** — transparent for existing users
2. **Settings backup (`claude_check_settings_backup`) does NOT migrate** — user rejected it (per MEMORY.md)
3. **Repo name:** `claude-team` at `/Users/nathan.heaps/src/nsheaps/claude-team`
4. **License:** MIT (confirmed)
5. **`--continue` is configurable** — add `--no-continue` flag and `CLAUDE_TEAM_CONTINUE` env var, default to `--continue`
6. **Agent-teams skill** moves to `nsheaps/.ai` as a plugin, installed by both repos via `.claude.json`
7. **claude-team calls `claude` directly** — no dependency on `run-claude`, lets the shell resolve the binary

### Updated Migration Steps

1. ~~Create `nsheaps/claude-team` repo~~ — DONE (skeleton at f4227cb)
2. Copy `claude-team`, `ct`, and slimmed `lib/` (no settings backup, no claude/happy routing)
3. Make `--continue` configurable
4. Set up release-it + gomplate + auto-PR pipeline
5. Add `claude-team.rb.gotmpl` formula template
6. Update claude-utils formula: `depends_on 'claude-team'`, remove `claude-team`/`ct` from bin/
7. Move agent-teams skill from `.claude/skills/agent-teams/` to `nsheaps/.ai` plugin
8. Update both repos' `.claude.json` to reference the skill plugin
