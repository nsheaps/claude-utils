#!/usr/bin/env bash
# CLI tests for claude-utils
# Run with: mise run test
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${SCRIPT_DIR}/../bin"
TESTS_PASSED=0
TESTS_FAILED=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

pass() {
  echo -e "${GREEN}PASS${NC}: $1"
  TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
  echo -e "${RED}FAIL${NC}: $1"
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
test_claude_clean_orphaned_dryrun

echo ""
echo "========================================"
echo -e "Results: ${GREEN}${TESTS_PASSED} passed${NC}, ${RED}${TESTS_FAILED} failed${NC}"
echo "========================================"

if [[ $TESTS_FAILED -gt 0 ]]; then
  exit 1
fi
