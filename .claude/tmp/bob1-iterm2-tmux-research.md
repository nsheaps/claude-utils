# iTerm2, tmux -CC, and Claude Code Agent Teams Research

## 1. Claude Code Agent Teams Documentation

### Overview

Agent teams are an experimental feature in Claude Code that allow multiple Claude Code instances to work together as a coordinated team. One session acts as the "team lead" that coordinates work, assigns tasks, and synthesizes results. "Teammates" work independently, each in its own context window, and communicate with each other via a shared mailbox and task list.

Source: [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)

### Enable Agent Teams

Agent teams are disabled by default. Enable by setting `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` to `1` in the environment or through `settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Source: [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)

### Display Modes (teammateMode)

Agent teams support two display modes, configured via the `teammateMode` setting:

| Mode | Description |
|------|-------------|
| **in-process** | All teammates run inside the main terminal. Use Shift+Up/Down to select teammates. Works in any terminal, no extra setup. |
| **split panes** (tmux) | Each teammate gets its own pane. See everyone's output at once and click into a pane to interact directly. Requires tmux or iTerm2. |
| **auto** (default) | Uses split panes if already inside a tmux session; otherwise falls back to in-process. |

Configuration in `settings.json`:

```json
{
  "teammateMode": "in-process"
}
```

Or via CLI flag:

```bash
claude --teammate-mode in-process
```

Source: [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)

### tmux and iTerm2 Requirements for Split-Pane Mode

The docs state:

> Split-pane mode requires either tmux or iTerm2 with the `it2` CLI.

Installation:
- **tmux**: Install through your system's package manager. See the [tmux wiki](https://github.com/tmux/tmux/wiki/Installing).
- **iTerm2**: Install the [`it2` CLI](https://github.com/mkusaka/it2), then enable the Python API in **iTerm2 > Settings > General > Magic > Enable Python API**.

Important note from the docs:

> `tmux` has known limitations on certain operating systems and traditionally works best on macOS. Using `tmux -CC` in iTerm2 is the suggested entrypoint into `tmux`.

The `"tmux"` setting enables split-pane mode and **auto-detects** whether to use tmux or iTerm2 based on the terminal environment.

Source: [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)

### How tmux Is Used as a Backend

When the `teammateMode` is set to `"tmux"` (or `"auto"` while inside tmux), Claude Code uses tmux to create split panes where each teammate gets its own pane. The team lead's terminal lists all teammates and their current work. In split-pane mode, you can see everyone's output at once and click into a pane to interact directly.

The architecture consists of:
- **Team lead**: The main Claude Code session that creates the team, spawns teammates, and coordinates work
- **Teammates**: Separate Claude Code instances in their own panes
- **Task list**: Shared list stored at `~/.claude/tasks/{team-name}/`
- **Mailbox**: Messaging system for inter-agent communication
- **Team config**: Stored at `~/.claude/teams/{team-name}/config.json`

Source: [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)

### Known Limitations

- Split panes are NOT supported in VS Code's integrated terminal, Windows Terminal, or Ghostty.
- No session resumption with in-process teammates (`/resume` and `/rewind` do not restore them).
- Orphaned tmux sessions may persist after team cleanup. Clean them up with `tmux ls` and `tmux kill-session -t <session-name>`.
- One team per session; no nested teams.
- All teammates inherit the lead's permission settings at spawn.

Source: [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)

---

## 2. iTerm2 tmux -CC (Control Mode) Integration

### What Is tmux -CC (Control Mode)?

tmux control mode is a special mode activated by passing the `-C` or `-CC` flags when starting tmux. It was originally designed by George Nachman (the creator of iTerm2) to allow applications to interface with tmux programmatically using a text-only protocol, rather than through the standard terminal-based UI.

There are two variants:
- **`-C` (single)**: Leaves the terminal in canonical mode (echo enabled), suitable for testing.
- **`-CC` (double)**: Disables canonical mode and most terminal features. Intended for applications. Sends DSC sequences (`\033P1000p`) for terminal detection.

Source: [tmux Control Mode Wiki](https://github.com/tmux/tmux/wiki/Control-Mode)

### The Protocol

In control mode, tmux communicates via a structured text-based protocol rather than rendering a visual interface:

**Command responses** are wrapped in guard lines:
```
%begin [timestamp] [command-number] [flags]
[command output]
%end [timestamp] [command-number] [flags]
```

**Asynchronous notifications** are prefixed with `%`:
- `%output [pane-id] [data]` -- pane output
- `%window-add` / `%window-renamed` -- window lifecycle
- `%sessions-changed` / `%session-changed` -- session state
- `%pane-mode-changed` -- pane mode changes
- `%subscription-changed` -- subscribed format updates

**Advanced features** include:
- **Flow control**: Prevents client lag via `pause-after` flags and `%extended-output` notifications with millisecond lag metrics.
- **Format subscriptions**: Clients subscribe to expressions via `refresh-client -B`, receiving `%subscription-changed` at most once per second.
- **Size management**: `refresh-client -C` allows control clients to influence window sizing.

Source: [tmux Control Mode Wiki](https://github.com/tmux/tmux/wiki/Control-Mode)

### How iTerm2 Uses tmux as a Backend

When you run `tmux -CC` inside iTerm2, instead of displaying the typical tmux text-mode interface (green status bar, prefix key commands, etc.), tmux sends structured protocol messages to iTerm2. iTerm2 then interprets these messages and renders the tmux session using its own native UI:

- **tmux windows** become native iTerm2 tabs or windows
- **tmux panes** become native iTerm2 split panes
- **tmux scrollback** is rendered via native iTerm2 scrollback with trackpad scrolling
- **Native macOS shortcuts** work normally (Cmd+C, Cmd+F, Cmd+T, Cmd+W, etc.)

The key insight is that **iTerm2 is acting as a GUI frontend for tmux's session management**. The tmux server still manages all the actual terminal sessions, but the user interacts with them through iTerm2's familiar interface rather than tmux's terminal-based UI.

Sources:
- [iTerm2 tmux Integration Documentation](https://iterm2.com/documentation-tmux-integration.html)
- [iTerm2 + tmux -CC: The Remote Development Setup Nobody Talks About](https://evoleinik.com/posts/iterm2-tmux-control-mode/)

### Why Selecting "iTerm2 Integration" Still Uses tmux Under the Hood

When Claude Code's agent teams docs mention iTerm2 as an alternative to tmux for split-pane mode, this is somewhat misleading -- iTerm2 integration **does** use tmux under the hood. The difference is in how it is presented:

| Approach | What Happens |
|----------|-------------|
| **Regular tmux** | Claude Code creates a tmux session and splits panes using standard tmux commands. The user sees the raw tmux interface with its green status bar and prefix-key shortcuts. |
| **iTerm2 with tmux -CC** | Claude Code creates a tmux session in control mode. iTerm2 intercepts the protocol and presents each pane as a native iTerm2 tab/window. The user sees familiar macOS-native windows. |

In both cases, **tmux is the backend** managing the terminal sessions. The "iTerm2 option" is really "tmux with iTerm2 as the rendering frontend via control mode."

This is why the Claude Code docs note:

> The `"tmux"` setting enables split-pane mode and auto-detects whether to use tmux or iTerm2 based on your terminal.

There is a single `"tmux"` setting that handles both cases -- it detects whether you are in iTerm2 and, if so, uses `-CC` control mode instead of raw tmux.

Sources:
- [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)
- [iTerm2 tmux Integration Documentation](https://iterm2.com/documentation-tmux-integration.html)

### Benefits of tmux -CC over Regular tmux

| Feature | Regular tmux | tmux -CC with iTerm2 |
|---------|-------------|---------------------|
| **Scrollback** | Requires entering tmux copy mode (prefix + `[`) | Native trackpad scrolling |
| **Copy/paste** | tmux copy mode or mouse mode | Native Cmd+C / Cmd+V |
| **Search** | tmux search commands | Native Cmd+F |
| **Window management** | prefix + c/n/p/w | Cmd+T (new tab), Cmd+W (close), Cmd+1/2/3 (switch) |
| **Split panes** | prefix + % / " | Standard iTerm2 split pane shortcuts |
| **Session persistence** | Yes (tmux keeps running) | Yes (same tmux backend) |
| **Reconnection** | `tmux attach` | `tmux -CC attach` |
| **Learning curve** | Must learn tmux keybindings | Use existing macOS/iTerm2 knowledge |
| **Visual appearance** | Text-mode green status bar | Native macOS window chrome |

Sources:
- [iTerm2 + tmux -CC blog post](https://evoleinik.com/posts/iterm2-tmux-control-mode/)
- [tmux in practice: iTerm2 and tmux (freeCodeCamp)](https://medium.com/free-code-camp/tmux-in-practice-iterm2-and-tmux-integration-7fb0991c6c01)

---

## 3. How Claude Code Leverages tmux -CC for Agent Teams

### The Connection

Claude Code agent teams need a way to display multiple independent Claude Code sessions (the team lead + N teammates) simultaneously. There are two fundamental approaches:

1. **In-process mode**: All teammates run within the lead's terminal. Navigation via Shift+Up/Down. No external dependencies. Works everywhere.
2. **Split-pane mode**: Each teammate gets its own visible pane. Requires a terminal multiplexer.

For split-pane mode, Claude Code uses tmux as the multiplexer backend. When the user is running iTerm2, Claude Code can leverage `tmux -CC` control mode to present each teammate in a native iTerm2 tab or pane rather than a raw tmux split.

### Why the iTerm2 Option Exists

The iTerm2 option exists for several reasons:

1. **Better user experience on macOS**: The Claude Code docs explicitly note that "tmux has known limitations on certain operating systems and traditionally works best on macOS. Using tmux -CC in iTerm2 is the suggested entrypoint into tmux." By using iTerm2's native UI, users avoid learning tmux keybindings and can interact with teammate panes using familiar macOS shortcuts.

2. **Click-to-interact**: In split-pane mode, users can "click into a teammate's pane to interact with their session directly." This is more intuitive with native iTerm2 panes than with tmux's mouse support.

3. **Reliability**: The docs list split-pane mode as unsupported in "VS Code's integrated terminal, Windows Terminal, or Ghostty." By using iTerm2's well-tested tmux integration, Claude Code gets reliable split-pane behavior on macOS without needing to implement terminal multiplexing itself.

4. **Session persistence**: Because tmux is still the backend, if iTerm2 crashes or is quit, the tmux sessions (and therefore the agent teammates) keep running. They can be reattached with `tmux -CC attach`.

### Auto-Detection Flow

When `teammateMode` is set to `"tmux"` or `"auto"` (default):

1. Claude Code checks if the user is already inside a tmux session.
   - If yes: uses tmux split-pane commands directly.
2. If not inside tmux, Claude Code checks if the terminal is iTerm2.
   - If yes: uses `tmux -CC` to create a control-mode session, which iTerm2 renders natively.
3. If neither: falls back to in-process mode.

### Practical Implications

- **macOS with iTerm2**: The recommended setup. Users get native tabs/panes for each teammate with no tmux learning curve.
- **macOS/Linux with tmux**: Users get standard tmux split panes. Must use tmux keybindings or mouse.
- **Any terminal without tmux**: Falls back to in-process mode. All teammates share one terminal window.
- **VS Code, Windows Terminal, Ghostty**: Split-pane mode is explicitly unsupported; must use in-process mode.

### Orphaned Sessions

A known issue: tmux sessions may persist after the team ends. Users should clean up with:

```bash
tmux ls
tmux kill-session -t <session-name>
```

This is a consequence of tmux being the backend -- sessions are designed to persist independently of the client.

Source: [Claude Code Agent Teams Docs](https://code.claude.com/docs/en/agent-teams)

---

## Summary

**tmux control mode (`-CC`)** is a text-based protocol that allows applications to interact with tmux programmatically. iTerm2 uses this protocol to present tmux sessions as native macOS windows and tabs, giving users a familiar GUI while tmux manages session persistence behind the scenes.

**Claude Code agent teams** leverage this same mechanism for their split-pane display mode. When running in iTerm2, Claude Code creates tmux sessions in control mode so that each teammate appears as a native iTerm2 pane. This provides the best user experience on macOS: native window management, click-to-interact, and familiar shortcuts, all backed by tmux's robust session management.

The key takeaway is that **the "iTerm2 option" and the "tmux option" are not fundamentally different** -- both use tmux as the backend. The distinction is whether the user sees raw tmux (standard mode) or native iTerm2 windows (control mode via `-CC`).

---

## All Sources

- [Claude Code Agent Teams Documentation](https://code.claude.com/docs/en/agent-teams)
- [tmux Control Mode Wiki (GitHub)](https://github.com/tmux/tmux/wiki/Control-Mode)
- [iTerm2 tmux Integration Documentation](https://iterm2.com/documentation-tmux-integration.html)
- [iTerm2 + tmux -CC: The Remote Development Setup Nobody Talks About (Eugene Oleinik)](https://evoleinik.com/posts/iterm2-tmux-control-mode/)
- [tmux in practice: iTerm2 and tmux (Alexey Samoshkin, freeCodeCamp/Medium)](https://medium.com/free-code-camp/tmux-in-practice-iterm2-and-tmux-integration-7fb0991c6c01)
- [tmux Integration Best Practices (iTerm2 Wiki, GitLab)](https://gitlab.com/gnachman/iterm2/-/wikis/tmux-Integration-Best-Practices)
- [it2 CLI (GitHub)](https://github.com/mkusaka/it2)
- [tmux Wiki: Installing](https://github.com/tmux/tmux/wiki/Installing)
