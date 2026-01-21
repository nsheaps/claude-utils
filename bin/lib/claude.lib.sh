#!/usr/bin/env bash
# claude.lib.sh - Shared Claude CLI helper functions
#
# Source this file in scripts that need to invoke claude/happy CLI.
# Provides intelligent routing between claude and happy binaries.
#
# Usage:
#   source "$(dirname "$0")/lib/claude.lib.sh"
#   claudeish [ARGS...]
#
# Based on: dotfiles/_home/interactive.d/claude.sh

# Package version - single source of truth
CLAUDE_UTILS_VERSION="v0.2.4"

# Commands that only exist in claude (not happy) - always redirect to claude
CLAUDE_ONLY_COMMANDS=("auth" "plugin")

# Commands that exist in both - pass through to whichever binary was requested
PASSTHROUGH_COMMANDS=("doctor" "daemon")

# Default binary preference (can be overridden before sourcing)
: "${CLAUDE_PREFERRED_BIN:=happy}"

_claudeish() {
  local BIN_NAME="$1"
  shift

  local HAS_CLAUDE_ONLY_COMMAND=false
  local HAS_PASSTHROUGH_COMMAND=false

  # Check if this is a claude-only command
  for cmd in "${CLAUDE_ONLY_COMMANDS[@]}"; do
    if [[ "${1:-}" == "$cmd" ]]; then
      HAS_CLAUDE_ONLY_COMMAND=true
      break
    fi
  done

  # Check if this is a passthrough command (exists in both CLIs)
  for cmd in "${PASSTHROUGH_COMMANDS[@]}"; do
    if [[ "${1:-}" == "$cmd" ]]; then
      HAS_PASSTHROUGH_COMMAND=true
      break
    fi
  done

  # Only redirect to claude for claude-only commands
  if [[ $HAS_CLAUDE_ONLY_COMMAND == true ]]; then
    BIN_NAME="claude"
  fi

  local HAS_SPECIAL_COMMAND=false
  if [[ $HAS_CLAUDE_ONLY_COMMAND == true ]] || [[ $HAS_PASSTHROUGH_COMMAND == true ]]; then
    HAS_SPECIAL_COMMAND=true
  fi

  # Fall back to claude if happy is not installed
  if [[ "$BIN_NAME" == "happy" ]] && ! command -v happy &> /dev/null; then
    echo "happy CLI not found. Install via \`npm install -g happy-coder\`" >&2
    echo "  see: https://happy.engineering/docs/quick-start/" >&2
    echo "Falling back to 'claude'." >&2
    BIN_NAME="claude"
  fi

  if [[ $HAS_SPECIAL_COMMAND == true ]]; then
    # pass through directly without extra flags
    command "$BIN_NAME" "$@"
    return
  fi

  # Add default flags for normal commands
  local FLAGS=("--allow-dangerously-skip-permissions" "$@")
  echo "Launching $BIN_NAME with flags:" >&2
  for flag in "${FLAGS[@]}"; do
    echo "  $flag" >&2
  done
  command "$BIN_NAME" "${FLAGS[@]}"
}

# Main entry point - routes to preferred binary
claudeish() {
  _claudeish "$CLAUDE_PREFERRED_BIN" "$@"
}

# Explicit binary wrappers
claude_bin() {
  _claudeish "claude" "$@"
}

happy_bin() {
  _claudeish "happy" "$@"
}
