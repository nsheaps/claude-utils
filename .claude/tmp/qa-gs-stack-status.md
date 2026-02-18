# QA Report: gs-stack-status Repo Setup and Release Pipeline

**QA Engineer**: Daffy Duck (Quality Assurance)
**Date**: 2026-02-18
**Task**: #132
**Repo**: `/Users/nathan.heaps/src/nsheaps/gs-stack-status` (GitHub: `nsheaps/gs-stack-status`)

## Files Reviewed

| File | Lines | Purpose |
|------|-------|---------|
| `.github/workflows/release.yaml` | 158 | CI release + Homebrew formula update |
| `.release-it.json` | 34 | release-it configuration |
| `Formula/gs-stack-status.rb.gotmpl` | 25 | Homebrew formula template |
| `package.json` | 16 | Project metadata + release deps |
| `.github/actions/github-app-auth/action.yml` | 78 | Composite action for GitHub App auth |
| `bin/gs-stack-status` | 1102 | Main bash script |
| `mise.toml` | 19 | Task runner config |
| `.gitignore` | 23 | Git ignore rules |
| `LICENSE` | 22 | MIT license |
| `plugins/git-spice/hooks/hooks.json` (ai-mktpl) | 16 | SessionStart hook for install check |
| `plugins/git-spice/hooks/scripts/check-gs-stack-status.sh` (ai-mktpl) | 9 | Install prompt script |

---

## REL-1 through REL-7 Comparison (claude-team findings)

Checking whether the gs-stack-status release pipeline pre-fixed the issues found in the claude-team QA (Task #115).

| REL ID | claude-team Issue | gs-stack-status Status | Notes |
|--------|-------------------|----------------------|-------|
| REL-1 | Missing explicit `GITHUB_TOKEN` on release-it step | **FIXED** | `release.yaml:41-42` explicitly passes `GITHUB_TOKEN: ${{ steps.auth.outputs.token }}` |
| REL-2 | `actions/checkout@v6` in composite action | **FIXED** | `action.yml:73` uses `actions/checkout@v4` |
| REL-3 | `shasum` not guaranteed on Ubuntu | **FIXED** | `release.yaml:80` uses `sha256sum` |
| REL-4 | `lib/` in `bin/` unusual | **N/A** | gs-stack-status has no `lib/` directory — single script in `bin/` |
| REL-5 | No `coreutils` dependency for `readlink -f` | **N/A** | Script doesn't use `readlink -f` |
| REL-6 | `GITHUB_JOB_URL` may not resolve | **NOT FIXED** | `release.yaml:113` still uses `${{ env.GITHUB_JOB_URL }}` |
| REL-7 | Heredoc `BODY_EOF` indentation bug | **FIXED** | `release.yaml:128-133` — heredoc content and `BODY_EOF` delimiter are at column 0, no indentation issue |

---

## Findings

### GSS-1: `GITHUB_JOB_URL` env var may not resolve (LOW)

**File**: `.github/workflows/release.yaml:113`
```yaml
JOB_URL: ${{ env.GITHUB_JOB_URL }}
```

Same as REL-6 from claude-team. `GITHUB_JOB_URL` is not a standard GitHub Actions env var. The `qoomon/actions--context@v4` step (line 57-59) may set it, but if it doesn't, `JOB_URL` will be empty in the PR body.

**Impact**: Low — PR body will show `**Workflow:**` with an empty value. Non-breaking.

**Recommendation**: Construct manually:
```yaml
JOB_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
```

### GSS-2: No README.md (LOW)

No README file exists in the repository. While the script's `--help` output is comprehensive, a README is expected for any public GitHub repo.

**Recommendation**: Add a basic README with usage, installation instructions (`brew install nsheaps/devsetup/gs-stack-status`), and a brief description.

### GSS-3: Script filename in help text says `.sh` (COSMETIC)

**File**: `bin/gs-stack-status:2,15`
```bash
# gs-stack-status.sh - Show git-spice stack tree with PR review/CI status
```
```
Usage: gs-stack-status.sh [--output interactive|markdown|osc8] [--no-status]
```

The script is installed as `gs-stack-status` (no `.sh`), but the help text and comment header still reference `gs-stack-status.sh`.

**Recommendation**: Update help text to use `gs-stack-status` (without `.sh` extension).

### GSS-4: Formula `test` block may fail without git-spice repo (LOW)

**File**: `Formula/gs-stack-status.rb.gotmpl:22-24`
```ruby
test do
  assert_match 'gs-stack-status', shell_output("#{bin}/gs-stack-status --help 2>&1")
end
```

The test uses `--help` which works standalone. **PASS** — this is correct. The `2>&1` captures stderr too in case of early failures. Good pattern.

### GSS-5: `depends_on 'git-spice'` — Homebrew tap dependency (INFO)

**File**: `Formula/gs-stack-status.rb.gotmpl:15`
```ruby
depends_on 'git-spice'
```

`git-spice` is not in homebrew-core — it's from a third-party tap. This means users must have the git-spice tap already added, or the formula install will fail. This is fine for the intended audience (git-spice users already have it), but worth documenting in a README.

### GSS-6: Script dependencies not declared in formula (INFO)

**File**: `bin/gs-stack-status:14`
```bash
# Requirements: gs, gh, jq, python3
```

The script requires `gs` (git-spice), `gh` (GitHub CLI), `jq`, and `python3`. The formula only declares `git-spice` and `gum` as dependencies. `jq` and `gh` are not declared.

- `gh` is commonly installed but not guaranteed
- `jq` is commonly installed but not guaranteed
- `python3` is available on macOS by default and most Linux

**Recommendation**: Consider adding `depends_on 'gh'` and `depends_on 'jq'` to the formula. `gum` is declared as a dependency but the script header doesn't list it — verify if `gum` is actually used by this script.

### GSS-7: `gum` declared as dependency but may not be used (MEDIUM)

**File**: `Formula/gs-stack-status.rb.gotmpl:16`
```ruby
depends_on 'gum'
```

The `gum` dependency was likely copied from the `claude-team` formula template. Searching the script for `gum`:

The 1102-line `bin/gs-stack-status` script does NOT use `gum` anywhere. This is a false dependency — it adds an unnecessary install requirement.

**Recommendation**: Remove `depends_on 'gum'` from the formula unless `gum` is actually used.

### GSS-8: `.pnp.cjs` and `.pnp.loader.mjs` committed to repo (LOW)

The `.gitignore` excludes `.pnp.*`:
```
.pnp.*
```

But `.pnp.cjs` (549KB) and `.pnp.loader.mjs` (72KB) are already tracked and committed. The gitignore rule was added after these files were committed.

**Impact**: Low — these are standard Yarn PnP files. They're large but expected for Yarn Zero-Installs. However, the `.gitignore` intent suggests they shouldn't be committed.

**Recommendation**: Either:
1. Remove the `.pnp.*` line from `.gitignore` (if Yarn Zero-Installs is intended)
2. Or `git rm --cached .pnp.cjs .pnp.loader.mjs` to un-track them (if they shouldn't be committed)

### GSS-9: `mise.toml` lint task won't catch script errors (INFO)

**File**: `mise.toml:7-13`
```toml
[tasks.lint]
run = """
for script in bin/*; do
  [ -d "$script" ] && continue
  echo "Checking $script..."
  bash -n "$script"
done
```

`bash -n` only checks syntax, not semantic errors (undefined variables, missing commands, etc.). This is consistent with claude-team's approach and is acceptable for a bash project. Just noting that ShellCheck would catch more issues.

---

## Script Execution Test

```
$ bin/gs-stack-status --help
Usage: gs-stack-status.sh [--output interactive|markdown|osc8] [--no-status]
       [--reviewed] [--no-reviewed] [--failing-ci] [--no-failing-ci]
       [--color] [--no-color] [--watch [SECONDS]]
...
```

**PASS** — Script executes and shows help. Exit code 0.

---

## Script Integrity Check

```
$ diff ai-mktpl/plugins/git-spice/scripts/gs-stack-status.sh gs-stack-status/bin/gs-stack-status
(no differences)
```

**PASS** — Extracted script is identical to source.

---

## Git-Spice Plugin Install Hook (ai-mktpl)

**File**: `plugins/git-spice/hooks/hooks.json`
```json
{
  "hooks": {
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "bash ${CLAUDE_PLUGIN_ROOT}/hooks/scripts/check-gs-stack-status.sh",
        "timeout": 5
      }]
    }]
  }
}
```

**File**: `plugins/git-spice/hooks/scripts/check-gs-stack-status.sh`
```bash
if ! command -v gs-stack-status &>/dev/null; then
  echo "gs-stack-status is not installed. Install it with:"
  echo "  brew install nsheaps/devsetup/gs-stack-status"
fi
```

**PASS** — Hook correctly:
- Checks if `gs-stack-status` is on PATH
- Provides correct install command with tap prefix
- Uses `command -v` (POSIX-compliant)
- Has reasonable 5s timeout
- Only fires on SessionStart (not every tool use)

---

## Positive Findings

- Release pipeline correctly fixes REL-1 (GITHUB_TOKEN), REL-2 (checkout@v4), REL-3 (sha256sum), REL-7 (heredoc)
- Workflow is a clean, well-structured copy of the claude-team pipeline with correct name substitutions
- Formula template uses correct repo URL and tag pattern
- Script extraction is byte-for-byte identical to source
- release-it config is correct (conventional commits, CHANGELOG, GitHub releases, npm disabled)
- GitHub App auth action uses `actions/checkout@v4` (not v6)
- package.json metadata is accurate (repo URL, license, description)
- Stale PR cleanup pattern is present
- Auto-merge retry with backoff is present

---

## Issue Summary

| ID | Severity | Description |
|----|----------|-------------|
| GSS-7 | **MEDIUM** | `gum` declared as formula dependency but not used by script |
| GSS-1 | LOW | `GITHUB_JOB_URL` env var may not resolve (same as REL-6) |
| GSS-2 | LOW | No README.md in repository |
| GSS-3 | COSMETIC | Help text references `gs-stack-status.sh` instead of `gs-stack-status` |
| GSS-6 | INFO | `gh` and `jq` runtime dependencies not declared in formula |
| GSS-8 | LOW | `.pnp.*` files committed despite `.gitignore` rule |

**1 MEDIUM, 3 LOW, 1 COSMETIC, 1 INFO issues found.**

No HIGH issues. The release pipeline successfully pre-fixed the critical bugs from the claude-team QA.
