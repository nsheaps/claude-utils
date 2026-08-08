# claude-utils

CLI utilities for Claude Code workflow management.

## Installation

```bash
brew install nsheaps/devsetup/claude-utils
```

That single command taps and installs in one step. The two-step form does the same thing:

```bash
brew tap nsheaps/devsetup
brew install claude-utils
```

The formula lives in [nsheaps/homebrew-devsetup](https://github.com/nsheaps/homebrew-devsetup), which is
why the tap is `nsheaps/devsetup` and not `nsheaps/claude-utils`. Homebrew derives a tap name by
stripping the `homebrew-` prefix from the repository name, and `brew install` needs all three
components — `<tap-user>/<tap-name>/<formula>` — to auto-tap. A two-component `brew install
nsheaps/claude-utils` is not a formula reference and fails with `No available formula with the name
"claude-utils"`.

## Commands

### Session Shortcuts

| Command | Description |
|---------|-------------|
| `ccresume` | Shorthand for `claude --resume` |
| `cccontinue` | Shorthand for `claude --continue` |
| `ccr` | Resume with visual feedback |
| `ccc` | Continue with visual feedback |

### Workspace Management

| Command | Description |
|---------|-------------|
| `cc-tmp` | Create temporary workspace in `/tmp` (persists after exit) |
| `cc-newsession` | Create new workspace (use `--temp` to delete on exit) |
| `cc-resume` | Interactive picker to resume existing workspaces |

### Agent Teams

| Command | Description |
|---------|-------------|
| `claude-team` | Launch Claude with agent teams enabled (interactive mode picker) |
| `ct` | Shorthand alias for `claude-team` |

### Utilities

| Command | Description |
|---------|-------------|
| `claude-update` | Update claude-code via Homebrew |
| `claude-clean-orphaned` | Kill orphaned Claude processes (PPID=1) |
| `claude-diagnostics` | Capture diagnostics for troubleshooting |
| `agent-hook-throttle` | Debounce/throttle helper for Claude Code hook scripts |

### Hook Development

`agent-hook-throttle` (CLI) and `bin/lib/agent-hook-throttle.sh` (sourceable bash
library) let a Claude Code hook — most commonly a `PreToolUse` hook, which fires
before every tool call — avoid redoing expensive checks (token refreshes, config
re-parsing, etc.) on every single invocation. Each caller picks its own key,
interval, and state directory; there is no global throttle policy.

```bash
# From a bash hook script:
source "$(dirname "$0")/lib/agent-hook-throttle.sh"  # or wherever it's vendored
if throttle_should_run "my-check" 300 "$CLAUDE_PLUGIN_DATA"; then
  do_expensive_check
  throttle_record "my-check" "$CLAUDE_PLUGIN_DATA"
fi

# From a hook written in another language, shell out to the CLI instead:
agent-hook-throttle should-run --key my-check --interval 300 --state-dir "$CLAUDE_PLUGIN_DATA"
```

`--force` bypasses the throttle for cases where the underlying state is known to be
stale (e.g. a token that's already expired) and the check must never be skipped.
Run `agent-hook-throttle --help` for the full command reference.

### For plugin and hook authors

These two are for Claude Code plugins and hooks to call, rather than for a human at a prompt. They
exist so each plugin does not reimplement logging, settings, and the hook JSON protocol inline.

| Command | Description |
|---------|-------------|
| `agent-plugin` | Logging, per-plugin settings, and dependency bootstrapping |
| `agent-hook` | Reads a hook's payload and emits the JSON a hook answers with |

A consuming plugin should check for them up front:

```bash
if ! command -v agent-plugin; then
  echo "agent-plugin is required for this plugin. Install with brew install nsheaps/devsetup/claude-utils" >&2
  exit 2
fi
```

#### `agent-plugin`

The plugin name comes from `--plugin` or `$AGENT_PLUGIN_NAME`, and is never guessed — a missing name
is an error. `agent-plugin --help` has the full contract.

```bash
# Logging. Goes to stderr, so it never corrupts a hook's JSON on stdout.
agent-plugin log "starting"          # info by default
agent-plugin log-debug "details"     # dropped unless the threshold allows it

# Settings, one file per plugin at .claude/settings.<plugin>.(yaml|yml|json).
# Dotted keys address nested values, like git config.
agent-plugin settings autoInstall true
agent-plugin settings some.nested.key
agent-plugin settings get-all              # this plugin
agent-plugin settings get-all --all        # every plugin (the only form that needs no name)

# Dependencies. Reads this plugin's own autoInstall setting to decide whether to install.
agent-plugin ensure-dependency gh "gh@latest"
```

The log threshold is `$AGENT_PLUGIN_LOG_LEVEL`, else the plugin's own `logLevel` setting, else
`info`. Settings live under `$CLAUDE_PROJECT_DIR` when it is set, and the current directory
otherwise.

#### `agent-hook`

Every command prints JSON on stdout and exits 0 — including the ones that block. On a non-zero exit
the harness discards stdout and reads stderr instead, so blocking is expressed in the JSON, never by
the exit status. Use `exec` so the hook's exit status is the CLI's.

```bash
# Read the payload into shell variables.
HOOK_INPUT="$(cat)"
eval "$(agent-hook export-input "$HOOK_INPUT")"
# now $HOOK_EVENT_NAME, $HOOK_TOOL_NAME, $HOOK_TOOL_INPUT_COMMAND, $HOOK_INPUT_JSON, ... are set

exec agent-hook halt "<reason shown to the user>"        # continue:false + stopReason
exec agent-hook warn-user "<warning shown to the user>"  # continue:true + systemMessage
exec agent-hook allow "<for the agent>" "<for the user>" # PreToolUse permissionDecision:allow
exec agent-hook deny "<for the agent>" "<for the user>"  # PreToolUse permissionDecision:deny

# PostToolUse. The tool has already run.
exec agent-hook post "<for the agent>" "<for the user>"
exec agent-hook post --warn "<for the agent>" "<for the user>"                # actionable
exec agent-hook post --replace-output "<new output>" "<for agent>" "<for user>"
```

Each decision carries a message for each audience: the agent-facing one goes where the model reads
it (`permissionDecisionReason` before a tool runs, `additionalContext` after), and the user-facing
one goes to `systemMessage`. `--replace-output` sets `updatedToolOutput`, which replaces the tool
result the model sees, as opposed to `additionalContext`, which appends to it.

## Usage Examples

```bash
# Quick resume/continue
ccr           # Resume with visual feedback
ccc           # Continue with visual feedback

# Workspace management
cc-tmp                    # Create workspace in /tmp (persists)
cc-newsession             # Create persistent workspace
cc-newsession --temp      # Create temporary workspace (deleted on exit)
cc-resume                 # Pick from existing workspaces

# Maintenance
claude-update                     # Update Claude Code
claude-clean-orphaned             # Dry-run: show orphaned processes
claude-clean-orphaned --force     # Actually kill orphaned processes

# Diagnostics
claude-diagnostics                # Create diagnostic archive
claude-diagnostics -v             # Print diagnostics to console
claude-diagnostics --no-archive   # Print only, no archive

# Agent teams
claude-team                       # Interactive mode picker
claude-team --mode tmux           # Tmux split panes
claude-team --mode in-process     # In-process mode
ct --mode auto                    # Shorthand with auto mode
```

## Workspace Behavior

The `cc-tmp` command creates workspaces in `/tmp/claude-workspace-<timestamp>`:

- Workspaces **persist** after Claude exits (unlike the original shell function)
- Use `cc-resume` to return to a previous workspace
- Use `cc-newsession --temp` if you want auto-deletion on exit

## Dependencies

- `fzf` - For interactive workspace selection (installed automatically)
- `gum` - For interactive prompts (installed automatically)
- `claude` - Claude Code CLI (must be installed separately)

`agent-plugin` and `agent-hook` are self-contained native binaries — they bundle their own runtime,
so no `node` (or `bun`) install is needed to run them.

## Development

The repo holds two kinds of source. `bin/` is hand-written bash. `packages/` is TypeScript, compiled
by `bun build --compile` into the native standalone executables `bin/agent-plugin` and
`bin/agent-hook`. Each is a single self-contained binary with its own copy of the Bun runtime and all
dependencies baked in — no interpreter is needed to run it.

Those two binaries are **not committed**. They are gitignored build output: `mise run build` produces
host binaries at `bin/agent-plugin` and `bin/agent-hook` for local development, and the release
pipeline cross-compiles all four platform targets on a single Linux runner and uploads them as
release-asset tarballs. The Homebrew formula installs the per-platform tarball from the release, so
the runnable artifact is built at release time, not stored in git. Edit `packages/*/src`, then run
`mise run build` to refresh your local binaries.

Bun is the package manager and build runtime; nx orchestrates the tasks. `node` stays in the dev
toolchain only because `release-it` and the `node:test` unit tests run under it — it is not needed at
runtime by the shipped binaries.

Every check comes in a `-shell` and a `-ts` flavour, with an aggregate on top:

```bash
# Install dependencies
bun install

# Everything: lint + format check + build + test + the installed-CLI acceptance test
mise run check

# Individually
mise run lint            # shellcheck + oxlint + tsc --noEmit
mise run fmt             # shfmt + prettier (writes)
mise run build           # compile packages/* into native binaries in bin/
mise run test            # bash CLI tests + node:test unit tests
mise run verify-install  # reproduce the Homebrew install and run the CLIs with node off PATH
mise run lint-formula    # rubocop on the Homebrew formula
```

`mise run verify-install` is the acceptance test that matters for these CLIs: it copies `bin/` to a
temp prefix and runs the binaries from a shell with node deliberately absent from `PATH`. That last
part is the point — the compiled executables are self-contained and must not depend on finding any
language runtime on whatever `PATH` a hook was handed.

## License

MIT
