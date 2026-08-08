#!/usr/bin/env bash
# Runs shellcheck or shfmt across every bash script in the repo.
#
#   scripts/shell-tools.sh lint        # shellcheck
#   scripts/shell-tools.sh fmt         # shfmt -w  (writes)
#   scripts/shell-tools.sh fmt-check   # shfmt -d  (diff only)
#
# The file list and the invocation live together in one bash script rather than being assembled in
# mise.toml, so the array handling runs under a known bash and does not depend on which shell mise
# hands a task body to.
#
# "Bash script" means the first line mentions bash, not that the filename ends in .sh — most of
# bin/ is extensionless on purpose. That same test is what keeps the generated node CLIs in bin/
# (bin/agent-plugin, bin/agent-hook) out of the shell tooling: their shebang says node.
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

mode="${1:-}"

files=()
# -print0/-d '' rather than word-splitting: a path with a space would otherwise arrive as two.
while IFS= read -r -d '' f; do
  if head -1 "$f" | grep -q 'bash'; then
    files+=("$f")
  fi
done < <(find bin test scripts -type f -print0 2>/dev/null)

if [ ${#files[@]} -eq 0 ]; then
  echo "No bash scripts found — nothing to do." >&2
  exit 0
fi

case "$mode" in
  lint)
    echo "Checking ${#files[@]} script(s) with shellcheck"
    shellcheck "${files[@]}"
    ;;
  fmt)
    echo "Formatting ${#files[@]} script(s) with shfmt"
    shfmt -w "${files[@]}"
    ;;
  fmt-check)
    echo "Checking ${#files[@]} script(s) with shfmt"
    shfmt -d "${files[@]}"
    ;;
  *)
    echo "Usage: scripts/shell-tools.sh <lint|fmt|fmt-check>" >&2
    exit 2
    ;;
esac
