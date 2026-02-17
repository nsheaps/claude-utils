# Teammate Launch Research

Research findings on how Claude Code spawns teammates, environment inheritance, and working directory behavior.

**Researcher**: Road Runner (Researcher)
**Date**: 2026-02-16
**Status**: Complete

---

## 1. Teammate Launch Customizability

### How Does Claude Code Spawn Teammates?

**Answer: Claude Code calls the `claude` binary directly. The spawn command cannot be customized or wrapped.**

#### tmux Backend — Exact Spawn Command

The most concrete evidence comes from [GitHub issue #25375](https://github.com/anthropics/claude-code/issues/25375) (tcsh/csh compatibility bug), which reveals the **actual tmux spawn command structure**:

```bash
cd /home/user && CLAUDECODE=1 CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1 /path/to/claude --agent-id ...
```

Key observations:
- Claude Code uses `tmux send-keys` to send this command string into the new pane
- The command is constructed with **bash-style inline environment variables** (`VAR=value command`)
- It `cd`s into the working directory, sets env vars inline, then calls the `claude` binary directly
- The binary path is resolved internally (likely `process.execPath` or similar)
- There is **no hook, config, or mechanism** to wrap or replace this command

Evidence from [issue #23615](https://github.com/anthropics/claude-code/issues/23615): tmux `send-keys` gets garbled when multiple agents spawn simultaneously, producing corrupted commands like `mmcd` instead of `cd`.

#### in-process Backend

- Teammates run as **hidden sessions within the same Node.js process** as the lead
- No separate binary invocation — it's an internal function call
- No subprocess spawning, no shell involvement
- Navigate with Shift+Up/Down

#### Can the Spawn Command Be Customized?

**No.** There is currently:
- No `spawnCommand` config option
- No hook that fires before teammate spawn to modify the command
- No way to route through a user wrapper script (e.g., `run-claude` or `happy`)
- [Feature request #24316](https://github.com/anthropics/claude-code/issues/24316) asks for custom `.claude/agents/` definitions as teammates, but this is about agent prompts, not the spawn mechanism itself

**Implication for claude-utils**: If users launch the lead via `claude-team` / `ct`, teammates spawned by that lead will NOT go through `claude-team`. They call the `claude` binary directly. Any wrapper logic (brew update checks, env setup, tmux -CC auto-launch) only applies to the lead.

### Backend Selection

The BackendRegistry selects the spawn backend based on:
1. `teammateMode` in settings.json (highest priority if set)
2. `--teammate-mode` CLI flag (session snapshot, but can be reset internally)
3. `CLAUDE_CODE_SPAWN_BACKEND` env var (`in-process`, `tmux`)
4. Auto-detection: checks for `$TMUX`, iTerm2, falls back to in-process

**Gotcha**: `teammateMode` in settings.json should always be set to prevent repeated iTerm2 detection prompts ([issue #24301](https://github.com/anthropics/claude-code/issues/24301)).

**Spawned teammates always use in-process mode internally** — the `teammateMode` only affects the lead's backend for creating visual panes.

---

## 2. Environment Variable Inheritance

### What Gets Set Automatically

These are set by Claude Code on every teammate spawn:

| Variable | Description |
|:---------|:------------|
| `CLAUDE_CODE_TEAM_NAME` | Team name |
| `CLAUDE_CODE_AGENT_ID` | Unique agent ID |
| `CLAUDE_CODE_AGENT_NAME` | Display name |
| `CLAUDE_CODE_AGENT_TYPE` | Agent type |
| `CLAUDE_CODE_PLAN_MODE_REQUIRED` | Whether plan approval required |
| `CLAUDE_CODE_PARENT_SESSION_ID` | Parent session ID |

### What Gets Inherited from the Lead's Environment

**For tmux backend**: The spawn command passes specific env vars **inline** (e.g., `CLAUDECODE=1 CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`). The tmux pane inherits the **tmux server's environment**, not the lead's full shell environment. This means:
- Vars set in the lead's shell but not in tmux's global env may not propagate
- The `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is explicitly passed inline in the spawn command
- Custom shell vars (PATH modifications, HOMEBREW_PREFIX, etc.) propagate only if they're in the tmux server env

**For in-process backend**: Since teammates run within the same Node.js process, they inherit the lead's full `process.env`. All environment variables present in the lead session are available to in-process teammates.

### What About settings.json `env` Block?

Teammates load the same settings.json files as any regular Claude Code session (user-level, project-level, local). This means:
- `env` block vars in `~/.claude/settings.json` apply to teammates
- `env` block vars in `.claude/settings.json` apply to teammates
- This is the **reliable** way to ensure env vars reach teammates

**Bug reference**: [Issue #11927](https://github.com/anthropics/claude-code/issues/11927) — `env` vars from `.claude/settings.json` were not being passed to plugins/MCPs. This may affect teammate subprocesses too.

### Permissions Inheritance

- Teammates start with the lead's **permission mode** ([docs](https://code.claude.com/docs/en/agent-teams))
- If lead uses `--dangerously-skip-permissions`, teammates do too
- **Bug**: Delegate mode restricts teammates incorrectly — teammates inherit the lead's delegate-mode restrictions instead of getting full tool access ([issue #25037](https://github.com/anthropics/claude-code/issues/25037))

---

## 3. Working Directory

### Can Teammates Be Launched in a Different Working Directory?

**No — confirmed.** The `Task` tool does not accept a `cwd` parameter. All teammates inherit the lead's working directory.

Evidence:
- The tmux spawn command explicitly `cd`s into the lead's directory: `cd /home/user && ... /path/to/claude --agent-id ...`
- No `cwd` parameter exists in the Task tool schema
- No feature request for this was found (it may be worth filing)

### Workaround

A teammate can run `cd /other/directory` as its first Bash command after spawning. However:
- The teammate's CLAUDE.md context is loaded from the lead's working directory, not the new directory
- MCP servers and skills are resolved from the lead's project
- This is a partial workaround at best

---

## Summary Table

| Question | Answer | Confidence |
|:---------|:-------|:-----------|
| Can spawn command be customized? | **No** | High |
| Does it call `claude` binary directly? | **Yes** (tmux) / **No** — internal function (in-process) | High |
| Full env inherited? | **tmux**: tmux server env + inline vars. **in-process**: yes, full process.env | Medium-High |
| settings.json `env` block works for teammates? | **Yes** — teammates load settings.json independently | High |
| Can teammates use different cwd? | **No** — must use Bash `cd` workaround | High |

---

## Open Questions / Gaps

1. **Exact inline env vars**: We know `CLAUDECODE=1` and `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` are passed. What other vars are passed inline in tmux mode? The team-specific vars (AGENT_ID, TEAM_NAME, etc.) are likely set as CLI args or inline vars too.
2. **Binary path resolution**: Is it always the same binary the lead is running? Or does it search PATH?
3. **`--agent-id` flag**: The spawn command includes `--agent-id` — is this a hidden CLI flag? What other hidden flags are used?

---

## Sources

- [Official Docs: Agent Teams](https://code.claude.com/docs/en/agent-teams)
- [Official Docs: Settings](https://code.claude.com/docs/en/settings)
- [Issue #25375: tcsh/csh inline env var syntax](https://github.com/anthropics/claude-code/issues/25375) — reveals spawn command structure
- [Issue #23615: tmux send-keys garbling](https://github.com/anthropics/claude-code/issues/23615)
- [Issue #24292: teammateMode tmux not creating panes](https://github.com/anthropics/claude-code/issues/24292)
- [Issue #24771: panes open but teammates disconnected](https://github.com/anthropics/claude-code/issues/24771)
- [Issue #25037: delegate mode breaks teammates](https://github.com/anthropics/claude-code/issues/25037)
- [Issue #24316: custom agents as teammates](https://github.com/anthropics/claude-code/issues/24316)
- [Issue #11927: env vars not passed to plugins/MCPs](https://github.com/anthropics/claude-code/issues/11927)
- [Issue #24301: settings.json teammateMode gotcha](https://github.com/anthropics/claude-code/issues/24301)
- [paddo.dev: Claude Code's Hidden Multi-Agent System](https://paddo.dev/blog/claude-code-hidden-swarm/)
- [Addy Osmani: Claude Code Swarms](https://addyosmani.com/blog/claude-code-agent-teams/)
- [alexop.dev: From Tasks to Swarms](https://alexop.dev/posts/from-tasks-to-swarms-agent-teams-in-claude-code/)
