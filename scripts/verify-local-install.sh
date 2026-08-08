#!/usr/bin/env bash
# Acceptance test for the native CLI binaries as a consumer actually meets them.
#
#   scripts/verify-local-install.sh
#
# Reproduces what the Homebrew formula does — copy bin/* into a prefix — and then checks the CLIs
# from a shell whose PATH contains that prefix and NOTHING else that could supply a runtime.
#
# agent-plugin and agent-hook are now native standalone executables produced by `bun build
# --compile`. Each bundles its own copy of the Bun runtime and all of its dependencies, so there is
# no `#!/usr/bin/env node` shebang to rewrite and no interpreter to pin — the file runs directly.
#
# That self-containment is the point of this test. These CLIs are invoked from hooks and plugin
# scripts whose PATH is whatever the harness handed them. Running the check with node deliberately
# absent from PATH is the only way to prove the installed executables do not depend on finding any
# language runtime there. A test that left node on PATH could not tell a self-contained binary from
# one that quietly reached for an interpreter.
#
# This does not touch the real Homebrew prefix and installs nothing.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
REPO="$PWD"

NATIVE_CLIS=(agent-plugin agent-hook)

PREFIX="$(mktemp -d)"
trap 'rm -rf "$PREFIX"' EXIT
mkdir -p "$PREFIX/bin"

echo "== simulating: bin.install Dir['bin/*']"
cp -R "$REPO"/bin/. "$PREFIX/bin/"

# The binaries must be present (built by `mise run build`) and executable. There is no shebang to
# rewrite — bun --compile emits a native executable with the correct mode.
for cli in "${NATIVE_CLIS[@]}"; do
  f="$PREFIX/bin/$cli"
  [ -f "$f" ] || {
    echo "FAIL: bin/$cli is missing. Run \`mise run build\` first." >&2
    exit 1
  }
  [ -x "$f" ] || {
    echo "FAIL: bin/$cli is not executable." >&2
    exit 1
  }
done

# A PATH with the install prefix plus the standard system directories, and nothing else. node lives
# under mise/Homebrew, neither of which is here, so a binary that secretly needed node would fail
# from this shell.
export PATH="$PREFIX/bin:/usr/bin:/bin:/usr/sbin:/sbin"
if command -v node >/dev/null 2>&1; then
  echo "NOTE: node is reachable on the reduced PATH ($(command -v node)); the self-contained" >&2
  echo "      assertion below is weaker than intended on this machine." >&2
fi

fails=0
check() {
  local label="$1" expected="$2"
  shift 2
  local output
  if ! output="$("$@" 2>&1)"; then
    : # a non-zero exit is fine for some checks; the assertion is on the output
  fi
  if printf '%s' "$output" | grep -qF -- "$expected"; then
    echo "PASS: $label"
  else
    echo "FAIL: $label"
    echo "  expected to contain: $expected"
    echo "  got: $output"
    fails=$((fails + 1))
  fi
}

echo
echo "== the acceptance check a consuming plugin runs"
# Verbatim from the consuming plugin's smoke check.
if ! command -v agent-plugin >/dev/null 2>&1; then
  echo "FAIL: command -v agent-plugin found nothing on PATH"
  fails=$((fails + 1))
else
  echo "PASS: command -v agent-plugin resolves to $(command -v agent-plugin)"
fi
if ! command -v agent-hook >/dev/null 2>&1; then
  echo "FAIL: command -v agent-hook found nothing on PATH"
  fails=$((fails + 1))
else
  echo "PASS: command -v agent-hook resolves to $(command -v agent-hook)"
fi

echo
echo "== the CLIs run self-contained with node absent from PATH"
check "agent-plugin --help" "Usage: agent-plugin" agent-plugin --help
check "agent-hook --help" "Usage: agent-hook" agent-hook --help
check "agent-hook halt" '"continue":false' agent-hook halt "formula smoke test"
check "agent-hook export-input" "HOOK_EVENT_NAME" agent-hook export-input '{"hook_event_name":"Stop"}'
check "agent-plugin log" "INFO [smoke] hello" agent-plugin --plugin smoke log hello

echo
if [ "$fails" -ne 0 ]; then
  echo "$fails check(s) failed."
  exit 1
fi
echo "All checks passed."
