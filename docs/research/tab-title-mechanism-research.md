# Research: What Controls Agent Team tmux Tab/Pane Title Text

**Researcher**: Road Runner (Deep Researcher)
**Date**: 2026-02-18
**Question**: What controls the tmux pane/tab title text for Claude Code agent team teammates? How can agents control what appears there?

## Executive Summary

Claude Code **does NOT natively set tmux window names or pane titles** for agent team teammates. The text visible in iTerm2 tabs when using `tmux -CC` mode comes from the **process command line** running in each pane (i.e., the `claude` command with its arguments), which tmux's `automatic-rename` feature extracts from the running process. Claude Code also does not emit OSC terminal title escape sequences — this is a known feature gap with multiple open (now closed as duplicate) feature requests. The "task naming convention" text the team saw was likely from the **Claude Code TUI status area** (the Ink-rendered interface), not the tab/pane title.

## 1. What Controls the Tab Text Today

### The Mechanism: tmux `automatic-rename`

By default, tmux sets each window's name based on the **currently running process** in the active pane. This is controlled by the `automatic-rename` option (on by default).

When Claude Code spawns a teammate via `tmux split-window`, the new pane runs:
```bash
claude --continue --permission-mode delegate ...
```

tmux's `automatic-rename` reads the process name and arguments, producing a window name like `claude` or `node` (since Claude Code is a Node.js/Bun application).

### In iTerm2 with `tmux -CC` (Control Mode)

When using `tmux -CC`, iTerm2 maps tmux windows to native tabs and tmux panes to split views. The tab title comes from:

1. **tmux window name** → shown as the iTerm2 tab title
2. **tmux pane title** → shown in per-pane title bar (if enabled in iTerm2 → Preferences → Appearance → Panes → "Show per-pane title bar with split panes")

Since Claude Code doesn't call `tmux rename-window` or `tmux select-pane -T`, the window name is whatever tmux's `automatic-rename` derives from the process.

**Confidence**: High — verified from [tmux Advanced Use wiki](https://github.com/tmux/tmux/wiki/Advanced-Use), [iTerm2 tmux integration docs](https://iterm2.com/documentation-tmux-integration.html).

### What About the Text the User Saw ("task naming convention")?

The user reported all agents showing "task naming convention" — this was likely the **Claude Code TUI status text** visible within the Ink-rendered terminal interface (the colored area at the top of each pane showing what the agent is currently doing), NOT the tmux tab title. When the team lead broadcast a message about task naming conventions, all agents processed it, and their current activity text (visible in the TUI) reflected that.

Alternatively, if the user configured `statusLine` in settings, the status line at the bottom of each Claude Code instance could also show task-related text.

**Confidence**: Medium-High — inference based on the timing (all agents processed same broadcast) and the architecture (Claude Code renders its own TUI, tmux shows process names).

## 2. What Claude Code Does NOT Do (Confirmed Gaps)

### Does NOT set terminal title via OSC escape sequences

Multiple feature requests confirm this is NOT implemented:

- **[#18326](https://github.com/anthropics/claude-code/issues/18326)**: "[FEATURE] Propagate session name to terminal title via escape sequences" — CLOSED as duplicate. Proposes using `\033]2;Claude: <session-name>\007` and `\033]0;Claude: <session-name>\007`.
- **[#20441](https://github.com/anthropics/claude-code/issues/20441)**: "Sync session name (/rename) with terminal tab title" — CLOSED as duplicate. Same request.
- **[#15802](https://github.com/anthropics/claude-code/issues/15802)**: "Feature Request: Set terminal title from within Claude Code session"
- **[#15082](https://github.com/anthropics/claude-code/issues/15082)**: "Terminal title escape sequences not passed through to terminal emulator"

The technical challenge is that Claude Code's React/Ink TUI captures stdout, so OSC escape sequences written to stdout aren't forwarded to the terminal emulator. They'd need to write directly to the TTY.

**Confidence**: High — 4 separate feature requests all confirm this gap.

### Does NOT call `tmux rename-window` or `tmux select-pane -T`

There is no evidence in GitHub issues, documentation, or community guides that Claude Code sets tmux window names or pane titles when spawning teammates. The spawning mechanism uses `tmux split-window -h` followed by `tmux send-keys` to launch the `claude` command.

**Confidence**: High — verified from [#23615](https://github.com/anthropics/claude-code/issues/23615), [#25396](https://github.com/anthropics/claude-code/issues/25396).

### Does NOT spawn teammates in separate windows (yet)

Currently all teammates are split panes within the same window. Feature requests for separate windows:
- **[#25396](https://github.com/anthropics/claude-code/issues/25396)**: "Spawn teammates in separate tmux windows" — CLOSED as duplicate
- **[#23615](https://github.com/anthropics/claude-code/issues/23615)**: "Agent teams should spawn in new tmux window, not split current pane"

Both were closed as duplicates, suggesting Anthropic may be tracking this internally.

**Confidence**: High.

## 3. The `statusLine` Configuration (Bottom Bar — NOT Tab Title)

The `statusLine` setting in `.claude/settings.json` controls a **bottom bar** within Claude Code's TUI, not the terminal/tab title:

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline.sh"
  }
}
```

The status line script receives session JSON on stdin and renders custom text at the bottom of the Claude Code interface. It's **internal to the TUI** — it does NOT set tmux or terminal titles.

**Confidence**: High — [official docs](https://code.claude.com/docs/en/statusline).

## 4. Community Workarounds

### 4.1 claude-code-terminal-title (bluzername) — Skill-Based Approach

A community skill that uses ANSI escape sequences to set terminal titles based on the current task.

**How it works**:
1. On first prompt (or task switch), the skill analyzes the user's prompt
2. Generates a concise title (e.g., "Debug: Auth API Flow")
3. Runs `scripts/set_title.sh` which uses `printf '\033]0;%s\007' "$title"` to set the terminal title
4. Prepends the current directory name: `my-project | Debug: Auth API Flow`

**Limitation for agent teams**: This is a **skill** — it requires the agent to call it (or it triggers on prompt analysis). It doesn't automatically set titles for spawned teammates. Each teammate would need the skill installed and would need to invoke it.

**Source**: [GitHub](https://github.com/bluzername/claude-code-terminal-title)

### 4.2 tmux-agent-indicator (accessd) — Hook-Based Approach

A tmux plugin that provides visual feedback for AI agent states via pane borders, window title colors, and status bar icons.

**How it works**:
1. Installs hooks in `.claude/settings.json` for `UserPromptSubmit`, `PermissionRequest`, `Stop`
2. Hooks call scripts that update tmux pane styling based on agent state (running, needs-input, done)
3. Color-codes pane borders and can modify window titles

**Relevance**: Demonstrates that **Claude Code hooks can modify tmux state** via shell scripts. The same pattern could be used to set pane/window titles.

**Source**: [GitHub](https://github.com/accessd/tmux-agent-indicator)

### 4.3 Manual Pre-Launch Title Setting

The simplest workaround from GitHub issues:
```bash
title() { echo -ne "\033]0;$1\007"; }
title "my-project" && claude
```

This sets the terminal title BEFORE launching Claude Code. Once Claude Code starts, its TUI takes over the terminal, and the title may or may not persist depending on the terminal emulator.

## 5. How Agents CAN Control Tab/Pane Titles

### Option A: Bash Command from Agent (MOST RELIABLE)

Agents can run tmux commands via the Bash tool:
```bash
# Set the tmux window name (appears as iTerm2 tab title)
tmux rename-window "Software Engineer" 2>/dev/null

# Set the pane title (appears in pane title bar)
tmux select-pane -T "Software Engineer" 2>/dev/null

# Prevent tmux from overriding with process name
tmux set-window-option automatic-rename off 2>/dev/null
```

**Important**: The `automatic-rename off` is critical — without it, tmux will revert the title to the process name.

**Caveat from team lead's testing**: This was tested and reportedly didn't work. Possible reasons:
- `automatic-rename` was re-enabled by tmux configuration
- The command ran in a subshell that wasn't the tmux pane's shell
- iTerm2's `tmux -CC` mode has different title propagation behavior

### Option B: SessionStart Hook (RECOMMENDED FOR AUTOMATION)

Add a hook that runs when each Claude Code session starts:
```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/set-pane-title.sh"
          }
        ]
      }
    ]
  }
}
```

Hook script:
```bash
#!/bin/bash
INPUT=$(cat)
AGENT_TYPE=$(echo "$INPUT" | jq -r '.agent_type // empty')
AGENT_NAME="${AGENT_TYPE:-${CLAUDE_CODE_AGENT_NAME:-claude}}"

tmux rename-window "$AGENT_NAME" 2>/dev/null || true
tmux select-pane -T "$AGENT_NAME" 2>/dev/null || true
tmux set-window-option automatic-rename off 2>/dev/null || true
exit 0
```

**Gap**: The `agent_type` field in SessionStart input may contain a slug (e.g., `general-purpose`) rather than the display name. And `CLAUDE_CODE_AGENT_NAME` availability is unconfirmed.

### Option C: OSC Escape Sequence from Bash Tool

```bash
printf '\033]1;%s\007' "Software Engineer"   # Set tab title (OSC 1)
printf '\033]2;%s\007' "Software Engineer"   # Set window title (OSC 2)
```

**Caveat**: In tmux, these escape sequences set the **pane title** (if `set-titles` is on), which is different from the **window name**. The behavior depends on tmux and terminal configuration.

### Option D: Agent System Prompt Instruction

Include in the agent's system prompt:
```
When you start, run: tmux rename-window "YOUR_ROLE" && tmux set-window-option automatic-rename off
```

**Caveat**: Relies on LLM compliance, adds noise to transcript.

## 6. Why tmux rename-window May Not Have Worked

The team lead reported that `tmux rename-window` didn't seem to work. Possible explanations:

1. **`automatic-rename` re-enabled**: If `~/.tmux.conf` has `set-option -g automatic-rename on`, it overrides per-window settings after the process changes.

2. **Wrong target**: When running inside Claude Code's Bash tool, the command may target the wrong pane/window. Use `-t` flag:
   ```bash
   tmux rename-window -t $(tmux display-message -p '#I') "Title"
   ```

3. **tmux -CC control mode**: In iTerm2's `tmux -CC` mode, window renames propagate via the `%window-renamed` control protocol message. This should work, but there could be timing issues.

4. **Claude Code's TUI interference**: Claude Code's Ink renderer may periodically set process title (via `process.title` in Node.js), which could trigger tmux's `automatic-rename` to override custom names.

5. **iTerm2 title override**: iTerm2 has its own title management that can override tmux titles. Check iTerm2 → Preferences → Profiles → General → Title settings.

## 7. Recommended Investigation Steps

To definitively answer "what sets the tab text", the team should:

1. **Inspect tmux state directly**:
   ```bash
   tmux list-windows -F '#{window_index}: #{window_name} (#{window_flags})'
   tmux list-panes -F '#{pane_index}: #{pane_title} (#{pane_current_command})'
   ```
   This will show the actual window names and pane titles tmux knows about.

2. **Check automatic-rename state**:
   ```bash
   tmux show-window-options automatic-rename
   ```

3. **Test rename persistence**:
   ```bash
   tmux rename-window "TEST-TITLE"
   tmux set-window-option automatic-rename off
   # Wait 5 seconds
   tmux display-message -p '#{window_name}'
   ```
   If it still shows "TEST-TITLE", rename works. If it reverted, something is overriding it.

4. **Check iTerm2 title source**: In iTerm2, right-click the tab → "Edit Session" → check what's in the "Title" field and "Title Format" dropdown.

## Open Questions

1. **Does Claude Code set `process.title`?** If Claude Code sets `process.title = "Claude: <status>"` in its Node.js process, tmux's `automatic-rename` would pick that up and display it as the window name. This could explain the behavior the user sees.

2. **What does the user actually see?** Is it the iTerm2 tab title (from tmux window name), the text within Claude Code's TUI (the colored status area), or the pane title bar? A screenshot would disambiguate.

3. **Are all agents in the same tmux window or separate windows?** If same window (current default), `rename-window` affects the whole tab, not individual panes. Only `select-pane -T` differentiates panes.

4. **Has Anthropic implemented [#18326](https://github.com/anthropics/claude-code/issues/18326)?** Both title-related issues were closed as "duplicate" — the parent issue may have been implemented in a recent release.

## Confidence Levels

| Finding | Confidence |
|:--------|:-----------|
| Claude Code does NOT emit OSC terminal title escape sequences | High — 4 feature requests confirm |
| Claude Code does NOT call tmux rename-window for teammates | High — GitHub issues confirm |
| Tab text comes from tmux `automatic-rename` (process name) | High — default tmux behavior |
| `statusLine` controls bottom bar within TUI, NOT tab title | High — official docs |
| The "task naming convention" text was from TUI, not tab title | Medium-High — inference |
| SessionStart hook + tmux rename-window should work | Medium — untested in this specific context |
| `CLAUDE_CODE_AGENT_NAME` env var availability in hooks | Medium — not confirmed in official docs |
| Claude Code may set `process.title` affecting tmux auto-rename | Medium — plausible but unverified |

## Sources

- [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams) — official, no mention of tab/title management
- [Claude Code Status Line Docs](https://code.claude.com/docs/en/statusline) — statusLine is bottom bar, not tab title
- [GitHub #18326: Propagate session name to terminal title](https://github.com/anthropics/claude-code/issues/18326) — CLOSED as duplicate, OSC escape sequence proposal
- [GitHub #20441: Sync /rename with terminal tab title](https://github.com/anthropics/claude-code/issues/20441) — CLOSED as duplicate
- [GitHub #15802: Set terminal title from within Claude Code](https://github.com/anthropics/claude-code/issues/15802) — feature request
- [GitHub #15082: Terminal title escape sequences not passed through](https://github.com/anthropics/claude-code/issues/15082) — confirms TUI captures stdout
- [GitHub #23615: Spawn in new tmux window, not split pane](https://github.com/anthropics/claude-code/issues/23615) — confirms split-pane spawning
- [GitHub #25396: Separate tmux windows for teammates](https://github.com/anthropics/claude-code/issues/25396) — feature request
- [claude-code-terminal-title (bluzername)](https://github.com/bluzername/claude-code-terminal-title) — community skill using ANSI escape sequences
- [tmux-agent-indicator (accessd)](https://github.com/accessd/tmux-agent-indicator) — tmux plugin for agent state via hooks
- [iTerm2 tmux Integration Docs](https://iterm2.com/documentation-tmux-integration.html) — how iTerm2 maps tmux concepts
- [tmux Advanced Use Wiki](https://github.com/tmux/tmux/wiki/Advanced-Use) — window names, pane titles, automatic-rename
- [Claude Code Internals Part 11: Terminal UI](https://kotrotsos.medium.com/claude-code-internals-part-11-terminal-ui-542fe17db016) — React/Ink TUI architecture (paywall)
- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks) — SessionStart hook input schema
