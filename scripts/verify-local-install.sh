#!/usr/bin/env bash
# Acceptance test for the node CLIs as a consumer actually meets them.
#
#   scripts/verify-local-install.sh
#
# Reproduces what the Homebrew formula does — copy bin/* into a prefix, then rewrite the
# `#!/usr/bin/env node` shebang to an absolute node path — and then checks the CLIs from a shell
# whose PATH contains that prefix and NOTHING else that could supply node.
#
# That last part is the point. `#!/usr/bin/env node` resolves through PATH at run time, and these
# CLIs are invoked from hooks and plugin scripts whose PATH is whatever the harness handed them.
# Running the check with node deliberately absent from PATH is the only way to prove the installed
# executables do not depend on finding it there. A test that left node on PATH would pass whether
# or not the shebang rewrite worked.
#
# This does not touch the real Homebrew prefix and installs nothing.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
REPO="$PWD"

NODE_CLIS=(agent-plugin agent-hook)

NODE_BIN="$(command -v node)"
if [ -z "$NODE_BIN" ]; then
  echo "FAIL: node is not on PATH, so there is no interpreter to pin the shebang to." >&2
  exit 1
fi
# Resolve through any shim so the pinned path is a real interpreter, which is what Homebrew's
# rewrite_shebang would use (the opt_bin path of the node keg).
NODE_ABS="$(cd "$(dirname "$NODE_BIN")" && pwd)/$(basename "$NODE_BIN")"

PREFIX="$(mktemp -d)"
trap 'rm -rf "$PREFIX"' EXIT
mkdir -p "$PREFIX/bin"

echo "== simulating: bin.install Dir['bin/*']"
cp -R "$REPO"/bin/. "$PREFIX/bin/"

echo "== simulating: rewrite_shebang detected_node_shebang"
# Homebrew matches %r{\A#! ?(?:/usr/bin/(?:env )?)?node( |$)} and replaces it with #!<abs>/node.
for cli in "${NODE_CLIS[@]}"; do
  f="$PREFIX/bin/$cli"
  [ -f "$f" ] || {
    echo "FAIL: bin/$cli is missing. Run \`mise run build\` first." >&2
    exit 1
  }
  perl -0pi -e 's{\A#! ?(?:/usr/bin/(?:env )?)?node( |$)}{#!'"$NODE_ABS"'$1}m' "$f"
  head -1 "$f" | grep -q "^#!$NODE_ABS" || {
    echo "FAIL: shebang rewrite did not take on bin/$cli" >&2
    exit 1
  }
done

# A PATH with the install prefix plus the standard system directories, and nothing else. node lives
# under mise/Homebrew, neither of which is here, so `env node` would fail from this shell.
export PATH="$PREFIX/bin:/usr/bin:/bin:/usr/sbin:/sbin"
if command -v node >/dev/null 2>&1; then
  echo "NOTE: node is reachable on the reduced PATH ($(command -v node)); the absolute-shebang" >&2
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
echo "== the CLIs run with node absent from PATH"
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
