#!/usr/bin/env bash
# CLI tests for claude-utils
# Run with: mise run test
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${SCRIPT_DIR}/../bin"
TESTS_PASSED=0
TESTS_FAILED=0

# Source stdlib for color constants and logging
source "$BIN_DIR/lib/stdlib.sh"

pass() {
  echo -e "${ANSI_GREEN}PASS${ANSI_RESET}: $1"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
  echo -e "${ANSI_RED}FAIL${ANSI_RESET}: $1"
  echo "  Expected: $2"
  echo "  Got: $3"
  TESTS_FAILED=$((TESTS_FAILED + 1))
}

# Test functions
test_ccresume_help() {
  local output
  output=$("$BIN_DIR/ccresume" --help 2>&1) || true
  if echo "$output" | grep -q "Resume last Claude Code session"; then
    pass "ccresume --help shows usage"
  else
    fail "ccresume --help shows usage" "Contains 'Resume last Claude Code session'" "$output"
  fi
}

test_cccontinue_help() {
  local output
  output=$("$BIN_DIR/cccontinue" --help 2>&1) || true
  if echo "$output" | grep -q "Continue last Claude Code session"; then
    pass "cccontinue --help shows usage"
  else
    fail "cccontinue --help shows usage" "Contains 'Continue last Claude Code session'" "$output"
  fi
}

test_ccr_help() {
  local output
  output=$("$BIN_DIR/ccr" --help 2>&1) || true
  if echo "$output" | grep -q "Resume Claude Code session"; then
    pass "ccr --help shows usage"
  else
    fail "ccr --help shows usage" "Contains 'Resume Claude Code session'" "$output"
  fi
}

test_ccc_help() {
  local output
  output=$("$BIN_DIR/ccc" --help 2>&1) || true
  if echo "$output" | grep -q "Continue Claude Code session"; then
    pass "ccc --help shows usage"
  else
    fail "ccc --help shows usage" "Contains 'Continue Claude Code session'" "$output"
  fi
}

test_claude_update_help() {
  local output
  output=$("$BIN_DIR/claude-update" --help 2>&1) || true
  if echo "$output" | grep -q "Update Claude Code via Homebrew"; then
    pass "claude-update --help shows usage"
  else
    fail "claude-update --help shows usage" "Contains 'Update Claude Code via Homebrew'" "$output"
  fi
}

test_claude_clean_orphaned_help() {
  local output
  output=$("$BIN_DIR/claude-clean-orphaned" --help 2>&1) || true
  if echo "$output" | grep -q "Kill orphaned Claude processes"; then
    pass "claude-clean-orphaned --help shows usage"
  else
    fail "claude-clean-orphaned --help shows usage" "Contains 'Kill orphaned Claude processes'" "$output"
  fi
}

test_cc_tmp_help() {
  local output
  output=$("$BIN_DIR/cc-tmp" --help 2>&1) || true
  if echo "$output" | grep -q "Create temporary Claude workspace"; then
    pass "cc-tmp --help shows usage"
  else
    fail "cc-tmp --help shows usage" "Contains 'Create temporary Claude workspace'" "$output"
  fi
}

test_cc_newsession_help() {
  local output
  output=$("$BIN_DIR/cc-newsession" --help 2>&1) || true
  if echo "$output" | grep -q "Create new Claude workspace"; then
    pass "cc-newsession --help shows usage"
  else
    fail "cc-newsession --help shows usage" "Contains 'Create new Claude workspace'" "$output"
  fi
}

test_cc_resume_help() {
  local output
  output=$("$BIN_DIR/cc-resume" --help 2>&1) || true
  if echo "$output" | grep -q "Interactive picker to resume Claude workspace"; then
    pass "cc-resume --help shows usage"
  else
    fail "cc-resume --help shows usage" "Contains 'Interactive picker to resume Claude workspace'" "$output"
  fi
}

test_claude_diagnostics_help() {
  local output
  output=$("$BIN_DIR/claude-diagnostics" --help 2>&1) || true
  if echo "$output" | grep -q "Claude Code Diagnostics"; then
    pass "claude-diagnostics --help shows usage"
  else
    fail "claude-diagnostics --help shows usage" "Contains 'Claude Code Diagnostics'" "$output"
  fi
}

test_run_claude_help() {
  local output
  output=$("$BIN_DIR/run-claude" --help 2>&1) || true
  if echo "$output" | grep -q "Launch Claude Code with bypass permissions"; then
    pass "run-claude --help shows usage"
  else
    fail "run-claude --help shows usage" "Contains 'Launch Claude Code with bypass permissions'" "$output"
  fi
}

test_claude_utils_help() {
  local output
  output=$("$BIN_DIR/claude-utils" --help 2>&1) || true
  if echo "$output" | grep -q "CLI utilities for Claude Code"; then
    pass "claude-utils --help shows usage"
  else
    fail "claude-utils --help shows usage" "Contains 'CLI utilities for Claude Code'" "$output"
  fi
}

test_claude_utils_version() {
  local output
  output=$("$BIN_DIR/claude-utils" --version 2>&1) || true
  if echo "$output" | grep -qE "^claude-utils v[0-9]+\.[0-9]+\.[0-9]+"; then
    pass "claude-utils --version shows version"
  else
    fail "claude-utils --version shows version" "Matches 'claude-utils vX.Y.Z'" "$output"
  fi
}

test_claude_team_help() {
  local output
  output=$("$BIN_DIR/claude-team" --help 2>&1) || true
  if echo "$output" | grep -q "Launch Claude Code with agent teams enabled"; then
    pass "claude-team --help shows usage"
  else
    fail "claude-team --help shows usage" "Contains 'Launch Claude Code with agent teams enabled'" "$output"
  fi
}

test_ct_help() {
  local output
  output=$("$BIN_DIR/ct" --help 2>&1) || true
  if echo "$output" | grep -q "Shorthand for claude-team"; then
    pass "ct --help shows usage"
  else
    fail "ct --help shows usage" "Contains 'Shorthand for claude-team'" "$output"
  fi
}

test_claude_team_invalid_mode() {
  local output
  local exit_code=0
  output=$("$BIN_DIR/claude-team" --mode invalid 2>&1) || exit_code=$?
  if [[ $exit_code -ne 0 ]] && echo "$output" | grep -q "Invalid mode"; then
    pass "claude-team rejects invalid mode"
  else
    fail "claude-team rejects invalid mode" "Non-zero exit and 'Invalid mode' message" "$output (exit: $exit_code)"
  fi
}

test_claude_clean_orphaned_dryrun() {
  local output
  # Should run dry-run without killing anything
  output=$("$BIN_DIR/claude-clean-orphaned" 2>&1 | cat) || true
  if echo "$output" | grep -qE "(No orphaned|dry-run|Found [0-9]+ orphaned)"; then
    pass "claude-clean-orphaned dry-run works"
  else
    fail "claude-clean-orphaned dry-run works" "Contains status message" "$output"
  fi
}

test_agent_hook_throttle_help() {
  local output
  output=$("$BIN_DIR/agent-hook-throttle" --help 2>&1) || true
  if echo "$output" | grep -q "Debounce/throttle helper for Claude Code hook scripts"; then
    pass "agent-hook-throttle --help shows usage"
  else
    fail "agent-hook-throttle --help shows usage" "Contains 'Debounce/throttle helper for Claude Code hook scripts'" "$output"
  fi
}

test_agent_hook_throttle_first_run() {
  local state_dir exit_code=0
  state_dir=$(mktemp -d)
  "$BIN_DIR/agent-hook-throttle" should-run --key first-run --interval 300 --state-dir "$state_dir" || exit_code=$?
  rm -rf "$state_dir"
  if [[ $exit_code -eq 0 ]]; then
    pass "agent-hook-throttle should-run allows a never-recorded key"
  else
    fail "agent-hook-throttle should-run allows a never-recorded key" "exit 0" "exit $exit_code"
  fi
}

test_agent_hook_throttle_record_then_throttled() {
  local state_dir exit_code=0
  state_dir=$(mktemp -d)
  "$BIN_DIR/agent-hook-throttle" record --key recent --state-dir "$state_dir"
  "$BIN_DIR/agent-hook-throttle" should-run --key recent --interval 300 --state-dir "$state_dir" || exit_code=$?
  rm -rf "$state_dir"
  if [[ $exit_code -eq 1 ]]; then
    pass "agent-hook-throttle should-run throttles a recently recorded key"
  else
    fail "agent-hook-throttle should-run throttles a recently recorded key" "exit 1" "exit $exit_code"
  fi
}

test_agent_hook_throttle_force_bypasses() {
  local state_dir exit_code=0
  state_dir=$(mktemp -d)
  "$BIN_DIR/agent-hook-throttle" record --key recent --state-dir "$state_dir"
  "$BIN_DIR/agent-hook-throttle" should-run --key recent --interval 300 --state-dir "$state_dir" --force || exit_code=$?
  rm -rf "$state_dir"
  if [[ $exit_code -eq 0 ]]; then
    pass "agent-hook-throttle should-run --force bypasses the throttle"
  else
    fail "agent-hook-throttle should-run --force bypasses the throttle" "exit 0" "exit $exit_code"
  fi
}

test_agent_hook_throttle_zero_interval_always_runs() {
  local state_dir exit_code=0
  state_dir=$(mktemp -d)
  "$BIN_DIR/agent-hook-throttle" record --key zero --state-dir "$state_dir"
  "$BIN_DIR/agent-hook-throttle" should-run --key zero --interval 0 --state-dir "$state_dir" || exit_code=$?
  rm -rf "$state_dir"
  if [[ $exit_code -eq 0 ]]; then
    pass "agent-hook-throttle should-run with interval 0 always runs"
  else
    fail "agent-hook-throttle should-run with interval 0 always runs" "exit 0" "exit $exit_code"
  fi
}

test_agent_hook_throttle_seconds_since() {
  local state_dir output
  state_dir=$(mktemp -d)
  output=$("$BIN_DIR/agent-hook-throttle" seconds-since --key never-recorded --state-dir "$state_dir")
  rm -rf "$state_dir"
  if [[ "$output" == "never" ]]; then
    pass "agent-hook-throttle seconds-since reports 'never' for unrecorded key"
  else
    fail "agent-hook-throttle seconds-since reports 'never' for unrecorded key" "never" "$output"
  fi
}

test_agent_hook_throttle_missing_args() {
  local exit_code=0
  "$BIN_DIR/agent-hook-throttle" should-run --key only-key >/dev/null 2>&1 || exit_code=$?
  if [[ $exit_code -eq 2 ]]; then
    pass "agent-hook-throttle should-run requires --state-dir/--interval"
  else
    fail "agent-hook-throttle should-run requires --state-dir/--interval" "exit 2" "exit $exit_code"
  fi
}

test_agent_hook_throttle_lib_sourced_functions() {
  # Exercise the sourceable library directly (not just the CLI wrapper),
  # since hooks written in bash are expected to `source` it rather than
  # shell out to the CLI.
  local state_dir result
  state_dir=$(mktemp -d)
  (
    source "$BIN_DIR/lib/agent-hook-throttle.sh"
    throttle_record "lib-test" "$state_dir"
    if throttle_should_run "lib-test" 300 "$state_dir"; then
      echo "should-have-been-throttled"
    else
      echo "throttled-as-expected"
    fi
  ) >"$state_dir/result.txt"
  result=$(cat "$state_dir/result.txt")
  rm -rf "$state_dir"
  if [[ "$result" == "throttled-as-expected" ]]; then
    pass "agent-hook-throttle.sh sourced functions work directly"
  else
    fail "agent-hook-throttle.sh sourced functions work directly" "throttled-as-expected" "$result"
  fi
}

# Run tests
echo ""
echo "========================================"
echo "claude-utils CLI Tests"
echo "========================================"
echo ""

test_ccresume_help
test_cccontinue_help
test_ccr_help
test_ccc_help
test_claude_update_help
test_claude_clean_orphaned_help
test_cc_tmp_help
test_cc_newsession_help
test_cc_resume_help
test_claude_diagnostics_help
test_run_claude_help
test_claude_utils_help
test_claude_utils_version
test_claude_team_help
test_ct_help
test_claude_team_invalid_mode
test_claude_clean_orphaned_dryrun
test_agent_hook_throttle_help
test_agent_hook_throttle_first_run
test_agent_hook_throttle_record_then_throttled
test_agent_hook_throttle_force_bypasses
test_agent_hook_throttle_zero_interval_always_runs
test_agent_hook_throttle_seconds_since
test_agent_hook_throttle_missing_args
test_agent_hook_throttle_lib_sourced_functions

echo ""
echo "========================================"
echo -e "Results: ${ANSI_GREEN}${TESTS_PASSED} passed${ANSI_RESET}, ${ANSI_RED}${TESTS_FAILED} failed${ANSI_RESET}"
echo "========================================"

if [[ $TESTS_FAILED -gt 0 ]]; then
  exit 1
fi
