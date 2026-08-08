---
name: version-upgrade-checklist
description: >-
  Checklist for safely upgrading Claude Code version with channel patching.
  Use before upgrading any agent's Claude Code installation.
---

# Version Upgrade Checklist

## Pre-Upgrade

1. **Check binary type of new version**
  ```bash
  # Install but don't activate yet
  mise install claude-code@NEW_VERSION
  NEW_BIN=$(mise where claude-code@NEW_VERSION)/bin/claude
  file "$(readlink -f "$NEW_BIN")"
  ```
  - JS bundle (v2.1.112 and below): text patcher works
  - Bun binary (v2.1.113+): requires binary patcher

2. **Verify patchable strings exist**
  ```bash
  strings "$(readlink -f "$NEW_BIN")" | grep 'isChannelAllowlisted:()=>'
  strings "$(readlink -f "$NEW_BIN")" | grep 'DevChannelsDialog:()=>'
  ```
  If either is missing, the minified names changed — patcher needs updating.

## Patching

3. **Run patcher against new version**
  ```bash
  # Back up first
  cp "$(readlink -f "$NEW_BIN")" "$(readlink -f "$NEW_BIN").bak"
  # Run patcher
  bin/claude-patch-channels "$(readlink -f "$NEW_BIN")"
  ```

4. **Validate patch** (use `patch-channels-validation` skill)
  ```bash
  "$NEW_BIN" --version  # must exit 0
  ```

  **Patcher success is NECESSARY but NOT SUFFICIENT.** "4 patches applied successfully" only means bytes were rewritten at the expected pattern sites — it does NOT prove behavior changed. New versions can have inlined copies, additional bytecode cache locations, new call sites, or different code paths that the patcher's pattern misses.

  Behavior validation REQUIRED before marking a version tested:
  - Launch claude with `--dangerously-load-development-channels` against a non-allowlisted plugin.
  - Confirm the DevChannelsDialog does NOT appear (it should auto-accept).
  - Confirm the channel plugin's tools/MCP server / messages actually load.

  If patcher reports OK but the dialog appears or the plugin doesn't load: patcher succeeded, patch is INEFFECTIVE. Do NOT add the version to the tested list. Investigate (likely the minified names changed, or a new code path was added, or Bun's bytecode cache moved).

  Source: Handler instruction (2026-05-05): "Remember the patcher can succeed but the patch can still not successfully change the behavior (make sure the skill says this)."

## Rollout

5. **Test on secondary agent first** (Henry or Alex, not Jack)
  ```bash
  # Update mise.toml in the secondary agent's repo
  # Let it run for a session to catch issues
  ```

6. **Activate for primary agent** only after secondary confirms stable

7. **Update tested versions table** in `docs/research/patcher-investigation/README.md`

## Rollback

If the patched binary fails:
```bash
# Restore backup
cp "$(readlink -f "$NEW_BIN").bak" "$(readlink -f "$NEW_BIN")"
# Or revert mise.toml to previous version
```

## Version History

| Version | Type | Patcher Status |
|---------|------|---------------|
| v2.1.94 | JS | Text patcher works |
| v2.1.112 | JS | Text patcher works (last JS version) |
| v2.1.113 | Bun ELF | First binary version |
| v2.1.119 | Bun ELF | Binary patcher works (verified) |

## Reference

See `docs/research/patcher-investigation/` for full investigation details.
