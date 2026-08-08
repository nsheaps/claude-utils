# claude-utils

CLI utilities for Claude Code workflow management.

## Installation

```bash
brew tap nsheaps/devsetup
brew install claude-utils
```

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
- `claude` - Claude Code CLI (must be installed separately)

## Development

```bash
# Install dependencies
yarn install

# Run tests
mise run test

# Check bash syntax
mise run lint

# Lint formula (requires rubocop)
mise run lint-formula
```

## License

MIT
