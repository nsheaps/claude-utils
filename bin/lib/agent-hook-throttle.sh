#!/usr/bin/env bash
# agent-hook-throttle.sh - Debounce/throttle helper for Claude Code hooks
#
# Claude Code PreToolUse hooks fire before every single tool call. Hooks
# that do expensive work (checking token expiry, re-parsing .envrc, etc.)
# need a way to avoid redoing that work on every call. This library
# generalizes the pattern first written inline in the github-app plugin's
# github-token-check.sh hook (DEBOUNCE_FILE + elapsed-seconds comparison).
#
# There is no single global throttle policy: every caller picks its own
# key, interval, and state directory, so different hooks can each tune
# their own throttle behavior independently.
#
# Usage (sourced):
#   source "$(dirname "$0")/lib/agent-hook-throttle.sh"
#
#   if throttle_should_run "github-app-token" 300 "$CLAUDE_PLUGIN_DATA"; then
#     do_expensive_check
#     throttle_record "github-app-token" "$CLAUDE_PLUGIN_DATA"
#   fi
#
#   # Force bypass: use when the underlying state is DEFINITELY stale
#   # (e.g. a token is already expired) and the check must never be
#   # skipped just because it ran recently.
#   if throttle_should_run "github-app-token" 300 "$CLAUDE_PLUGIN_DATA" --force; then
#     ...
#   fi
#
# Usage (CLI, for hooks not written in bash):
#   agent-hook-throttle should-run --key KEY --interval SECONDS --state-dir DIR
#   agent-hook-throttle record --key KEY --state-dir DIR
#   See: bin/agent-hook-throttle --help
#
# NOTE: this file is meant to be sourced into caller scripts, so it does
# NOT set -euo pipefail (that would change the caller's shell options).
# The bin/agent-hook-throttle CLI entry point sets its own strict mode.

# throttle_state_file KEY STATE_DIR
#
# Prints the path to the timestamp file used for KEY within STATE_DIR.
# KEY is sanitized to a safe filename (only [A-Za-z0-9._-] retained; every
# other character becomes "_") so callers can pass human-readable keys
# like "github-app/token-check" without worrying about path separators.
throttle_state_file() {
  local key="$1"
  local state_dir="$2"
  local safe_key
  safe_key="$(printf '%s' "$key" | tr -c 'A-Za-z0-9._-' '_')"
  printf '%s/%s.throttle\n' "$state_dir" "$safe_key"
}

# throttle_should_run KEY INTERVAL_SECONDS STATE_DIR [--force]
#
# Returns 0 (true, "run now") when any of these hold:
#   - --force was passed: always run, regardless of throttle state. Use
#     this for the "definitely stale, must recheck" case (e.g. a token is
#     already known to be expired) -- never let throttling suppress a
#     check that MUST happen.
#   - KEY has never been recorded (first run).
#   - at least INTERVAL_SECONDS have elapsed since the last recorded run.
#
# Returns 1 (false, "skip") otherwise -- still within the throttle window.
#
# This function does NOT record the run itself; call throttle_record once
# the check has actually run (see usage examples above).
throttle_should_run() {
  local key="$1"
  local interval="$2"
  local state_dir="$3"
  local force="${4:-}"

  if [[ "$force" == "--force" || "$force" == "true" || "$force" == "1" ]]; then
    return 0
  fi

  local state_file
  state_file="$(throttle_state_file "$key" "$state_dir")"

  if [[ ! -f "$state_file" ]]; then
    return 0
  fi

  local last_run now elapsed
  last_run="$(cat "$state_file" 2>/dev/null || echo 0)"
  # Guard against a corrupt/non-numeric state file -- treat as "never run"
  # rather than failing the arithmetic comparison below.
  if ! [[ "$last_run" =~ ^[0-9]+$ ]]; then
    return 0
  fi
  now="$(date +%s)"
  elapsed=$((now - last_run))

  if ((elapsed >= interval)); then
    return 0
  fi

  return 1
}

# throttle_record KEY STATE_DIR
#
# Records that a check for KEY ran just now (writes the current epoch
# seconds to the state file). Creates STATE_DIR if it doesn't exist yet.
throttle_record() {
  local key="$1"
  local state_dir="$2"
  local state_file
  state_file="$(throttle_state_file "$key" "$state_dir")"
  mkdir -p "$state_dir"
  date +%s >"$state_file"
}

# throttle_seconds_since KEY STATE_DIR
#
# Prints the number of seconds since KEY was last recorded, or "never" if
# it has not been recorded (or the state file is corrupt). Useful for
# diagnostics/logging inside hooks.
throttle_seconds_since() {
  local key="$1"
  local state_dir="$2"
  local state_file
  state_file="$(throttle_state_file "$key" "$state_dir")"

  if [[ ! -f "$state_file" ]]; then
    echo "never"
    return 0
  fi

  local last_run now
  last_run="$(cat "$state_file" 2>/dev/null || echo 0)"
  if ! [[ "$last_run" =~ ^[0-9]+$ ]]; then
    echo "never"
    return 0
  fi
  now="$(date +%s)"
  echo $((now - last_run))
}
