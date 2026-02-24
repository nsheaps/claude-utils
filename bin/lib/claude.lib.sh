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

# Source stdlib for printing utilities (error, warn, hint, etc.)
source "$(dirname "${BASH_SOURCE[0]}")/stdlib.sh"

# Package version - single source of truth
CLAUDE_UTILS_VERSION="v0.8.11"

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
  if [[ "$BIN_NAME" == "happy" ]] && ! command -v happy &>/dev/null; then
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

simple_claudeish() {
  # same as claudeish but always runs claude and always with the default flags
  local FLAGS=("--allow-dangerously-skip-permissions" "$@")
  echo "Launching claude with flags:" >&2
  for flag in "${FLAGS[@]}"; do
    echo "  $flag" >&2
  done
  command "claude" "${FLAGS[@]}"
}

# --- Settings backup utilities ---

CLAUDE_HOME="${CLAUDE_HOME:-$HOME/.claude}"
CLAUDE_BACKUP_DIR="${CLAUDE_HOME}/backups"

# Files to monitor for backup (relative to CLAUDE_HOME)
CLAUDE_BACKUP_FILES=("settings.json")

_claude_find_latest_backup() {
  # Find the most recent backup of a file
  # Usage: _claude_find_latest_backup "settings.json"
  # Returns: path to latest backup, or empty string
  local rel_path="$1"
  local latest=""

  if [[ ! -d "$CLAUDE_BACKUP_DIR" ]]; then
    return
  fi

  # Find all backups of this file sorted by date dir (newest first)
  while IFS= read -r backup_file; do
    latest="$backup_file"
    break
  done < <(find "$CLAUDE_BACKUP_DIR" -path "*/$rel_path" -type f 2>/dev/null | sort -r)

  echo "$latest"
}

_claude_backup_file() {
  # Back up a single file to ~/.claude/backups/YYYY-MM-DD/<rel_path>
  # Usage: _claude_backup_file "settings.json"
  local rel_path="$1"
  local source_file="$CLAUDE_HOME/$rel_path"
  local today
  today="$(date +%Y-%m-%d)"
  local dest_dir="$CLAUDE_BACKUP_DIR/$today"
  local dest_file="$dest_dir/$rel_path"

  mkdir -p "$(dirname "$dest_file")"
  cp "$source_file" "$dest_file"
  echo "Backed up $rel_path to $dest_file" >&2
}

claude_check_settings_backup() {
  # Check monitored files for changes/shrinkage after a claude session.
  # Intended to be called from a trap.
  local rel_path
  for rel_path in "${CLAUDE_BACKUP_FILES[@]}"; do
    local current_file="$CLAUDE_HOME/$rel_path"

    # Skip if the file doesn't exist
    if [[ ! -f "$current_file" ]]; then
      continue
    fi

    local latest_backup
    latest_backup="$(_claude_find_latest_backup "$rel_path")"

    # Fail if the file is empty
    if [[ ! -s "$current_file" ]]; then
      error "$current_file is empty!"
      if [[ -n "$latest_backup" ]]; then
        error "Restore from backup with:"
        hint "cp \"$latest_backup\" \"$current_file\""
      else
        error "No backup available to restore from."
      fi
      return 1
    fi

    # No backup exists yet - create the first one
    if [[ -z "$latest_backup" ]]; then
      _claude_backup_file "$rel_path"
      continue
    fi

    # Compare hashes
    local current_hash backup_hash
    current_hash="$(shasum -a 256 "$current_file" | cut -d' ' -f1)"
    backup_hash="$(shasum -a 256 "$latest_backup" | cut -d' ' -f1)"

    if [[ "$current_hash" == "$backup_hash" ]]; then
      # Identical, nothing to do
      continue
    fi

    # Files differ - warn and back up
    warn "WARNING: $rel_path has changed since last backup ($latest_backup)"
    _claude_backup_file "$rel_path"
    sleep 2
  done
}
