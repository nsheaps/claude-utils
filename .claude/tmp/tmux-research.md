# tmux Research: Usage Patterns for Claude Code Agent Teams

**Date:** 2026-02-16  
**Context:** Investigating tmux behavior for orchestrating Claude Code agent teams  
**Focus:** Accuracy via official docs, man pages, and real-world gotchas

---

## 1. `tmux send-keys` — Exact Syntax and Behavior

### Basic Syntax
```bash
tmux send-keys -t <pane> "text" <key-name>
```

**Key behaviors:**
- tmux checks each argument: if it's a reserved key name, it sends the escape sequence; otherwise, it's sent as literal text.
- Reserved key names (case-sensitive): `Enter`, `Tab`, `Escape`, `Space`, `C-m` (carriage return), `C-c`, etc.
- Multiple text words require quoting: `tmux send-keys -t pane "ls -la"` (without quotes, the space would be removed)

### Enter vs. Newline in String

**Documented correct syntax:**
```bash
# Correct: Enter as separate argument
tmux send-keys -t pane "command" Enter

# WRONG: newline in string alone (won't trigger Enter key)
tmux send-keys -t pane "command\n"

# Alternative: C-m (carriage return) as separate argument
tmux send-keys -t pane "command" C-m
```

**Why the difference matters:**
- `Enter` as a separate argument triggers the reserved key lookup → sends actual Return key escape sequence
- `\n` in a string is a literal newline character, not a key press
- Use `-l` flag to disable key lookup: `tmux send-keys -l -t pane "Enter"` sends the literal characters "E", "n", "t", "e", "r"

**Source:** [tmux(1) man page](https://man7.org/linux/man-pages/man1/tmux.1.html), [Blog: tmux send-keys](https://blog.damonkelley.me/2016/09/07/tmux-send-keys)

### Race Conditions and Pane State Issues

**Known problems:**

1. **Pane Not Ready for Input**
   - `send-keys` is asynchronous; if pane is initializing or running a command, keystrokes may be lost
   - No built-in blocking/waiting mechanism in `send-keys`

2. **Copy Mode Interference**
   - Pane in copy mode won't process regular input; keystrokes are interpreted as copy-mode commands
   - Sending regular commands while pane is in copy mode causes them to execute as copy-mode navigation (e.g., `j`, `k` = scroll)

3. **Rapid Successive Calls**
   - Multiple `send-keys` calls in quick succession can execute out of order or lose input due to asynchronous execution
   - [GitHub Issue #1517](https://github.com/tmux/tmux/issues/1517): `send-keys` executes asynchronously; `copy-pipe-and-cancel` does not wait for completion

**Mitigation strategies:**
- Insert explicit delays: `sleep 0.1` between successive `send-keys` calls
- Verify pane is active before sending: `tmux select-pane -t <pane>` (forces focus)
- Use `tmux display-message` for confirmation
- Avoid sending keys rapidly after spawning a new pane

**Sources:** [tmux GitHub Issue #1517](https://github.com/tmux/tmux/issues/1517), [GitHub Issue #2220](https://github.com/tmux/tmux/issues/2220), [Gist: tmux copy-mode OSX](https://gist.github.com/brendanhay/1769870)

### Edge Cases with `-l` Flag

**Purpose:** Disable key name lookup, send arguments as literal character sequences.

**Example gotcha:**
```bash
# Without -l: Enter is interpreted as Return key
tmux send-keys -t pane "command" Enter  # Sends: command<CR>

# With -l: Enter is sent as literal E-n-t-e-r
tmux send-keys -l -t pane "command" Enter  # Sends: commandEnter (6 chars)
```

**Other edge cases:**
- Leading hyphens in strings: May be misinterpreted as flags; wrap in quotes or use `--` to terminate flag parsing
- Trailing semicolons: Some tools may interpret them as command terminators; escape if needed
- Spaces in unquoted strings: Spaces delimit arguments; quote multi-word strings

**Source:** [GitHub Issue #1425](https://github.com/tmux/tmux/issues/1425), [Linux Hint: send-keys](https://linuxhint.com/tmux-send-keys/)

---

## 2. `tmux capture-pane` — Programmatic Output Capture

### Basic Syntax
```bash
tmux capture-pane -p -t <pane> [-S start] [-E end]
```

**Flags:**
- `-p` — Print to stdout (instead of joining clipboard or internal buffer)
- `-t <pane>` — Target pane (format: `session:window.pane`, e.g., `mysession:0.1`)
- `-S <line>` — Start line (0 = first visible, negative = history, `-` = start of history)
- `-E <line>` — End line (default = end of visible content)
- `-a` — Include alternate screen (useful for programs like vim)
- `-e` — Include escape sequences (preserves colors/formatting)
- `-J` — Join wrapped lines

### Common Patterns
```bash
# Capture entire scrollback to stdout
tmux capture-pane -p -t mysession:0.0 -S -

# Pipe to file
tmux capture-pane -p -t pane > output.txt

# Capture specific range (last 50 lines)
tmux capture-pane -p -t pane -S -50

# With color codes
tmux capture-pane -p -e -t pane
```

**Source:** [Baeldung: tmux logging](https://www.baeldung.com/linux/tmux-logging), [tmuxai: capture-pane](https://tmuxai.dev/tmux-capture-pane/), [Fig: capturep](https://fig.io/manual/tmux/capturep)

---

## 3. `tmux new-session -d` — Detached Session Creation

### Basic Syntax
```bash
tmux new-session -d -s <session-name> -c <start-directory> [command]
```

**Flags:**
- `-d` — Create session without attaching (runs in background)
- `-s <name>` — Session name (must be unique)
- `-c <directory>` — Starting working directory for new windows
- `[command]` — Optional default command to run (if omitted, shell starts)

### Example
```bash
tmux new-session -d -s work -c ~/projects
tmux send-keys -t work "npm start" Enter
```

**Important:** `-d` flag is essential for background operation in scripts; without it, tmux tries to attach and blocks until you exit.

**Source:** [GitHub: Getting Started](https://github.com/tmux/tmux/wiki/Getting-Started), [RedHat: Introduction to tmux](https://www.redhat.com/en/blog/introduction-tmux-linux)

---

## 4. `tmux -CC` (Control Mode) — iTerm2 Integration

### Activation
```bash
tmux -CC                # Single -C: control mode
tmux -CC                # Double -CC: control mode + disables canonical terminal mode
TERM=iterm2 tmux -CC    # iTerm2-optimized variant
```

### Protocol Overview

**What it does:**
- Replaces terminal rendering with structured text protocol
- Allows iTerm2 to display tmux windows as native iTerm2 windows/tabs
- Sends `\033P1000p` DSC sequence at startup (iTerm2 detects this and enables integration)
- Outputs `%exit` line + ST sequence (`\033\`) when client exits

**Command/Response Structure:**
- Clients send standard tmux commands (e.g., `send-keys`, `list-panes`)
- Responses wrap in `%begin` / `%end` guards (success) or `%begin` / `%error` (failure)
- Each response includes timestamp, command number, and flags

**Asynchronous Notifications** (prefixed with `%`):
- `%window-add`, `%window-close`, `%window-renamed`
- `%session-changed`, `%sessions-changed`
- `%pane-mode-changed`
- `%output <pane-id>` — Pane output (characters < ASCII 32 and backslashes encoded as octal)

### Flow Control
```bash
refresh-client -f pause-after=30   # Pause when client falls behind
```
- Tmux sends `%extended-output` with lag information when paused

### Key Differences from Regular Mode
- No terminal rendering overhead; pure text protocol
- **For Claude Code:** iTerm2 detects control mode and can render split panes natively
- Structured output makes programmatic parsing feasible
- SSH-friendly (works over remote connections)

**Sources:** [iTerm2 documentation](https://iterm2.com/documentation-tmux-integration.html), [GitHub: Control Mode Wiki](https://github.com/tmux/tmux/wiki/Control-Mode), [Medium: iterm2-tmux-control-mode](https://evoleinik.com/posts/iterm2-tmux-control-mode/), [GitLab: Best Practices](https://gitlab.com/gnachman/iterm2/-/wikis/tmux-Integration-Best-Practices)

---

## 5. Claude Code + tmux — Known Issues

### Critical Issues for Agent Teams

1. **Pane Index Mismatch** ([Issue #25375](https://github.com/anthropics/claude-code/issues/25375))
   - Claude Code hardcodes 0-based pane indexing
   - User's `set -g pane-base-index 1` (or other values) causes messages to target wrong pane
   - **Fix needed:** Query actual pane-base-index before calculating target pane

2. **Teammate Inbox Never Polled** ([Issue #23415](https://github.com/anthropics/claude-code/issues/23415), [#24108](https://github.com/anthropics/claude-code/issues/24108))
   - Spawned teammates launch in tmux panes but never read inbox files
   - Messages sent via SendMessage write to JSON but remain `"read": false`
   - Teammates stuck at idle prompt, never receive instructions
   - **Scope:** Affects macOS, tmux backend

3. **Shell Compatibility** ([Issue #25375](https://github.com/anthropics/claude-code/issues/25375))
   - Inline env var syntax `CLAUDECODE=1 command` is bash/zsh-only
   - Fails with "Command not found" on tcsh/csh shells
   - **Fix needed:** Use `env CLAUDECODE=1` or export separately

4. **Send-Keys Corruption at Scale**
   - Splitting current pane for many teammates causes garbled send-keys
   - **Recommendation:** Spawn in new window instead of split pane

5. **Messaging Disconnection with iTerm2 -CC** ([Issue #24771](https://github.com/anthropics/claude-code/issues/24771))
   - Split panes open, separate Claude Code sessions launch, but teammate processes never receive instructions
   - Lead's messaging system disconnected from teammate sessions
   - **Status:** Open; likely related to control mode protocol misalignment

**Sources:** [Claude Code Issues](https://github.com/anthropics/claude-code/issues) #23415, #23615, #24108, #24771, #25375

---

## 6. Practical Recommendations for Agent Orchestration

### Safe send-keys Pattern
```bash
#!/usr/bin/env bash

# Always use Enter as separate argument, with delay
tmux send-keys -t "$PANE" "command" Enter
sleep 0.1   # Safety margin before next command

# Verify pane is responsive before sending input
tmux select-pane -t "$PANE"
tmux send-keys -t "$PANE" "next-command" Enter
```

### Session + Pane Spawn Pattern
```bash
# Create session with working directory
tmux new-session -d -s work -c /path/to/dir

# Spawn new window in existing session
tmux new-window -t work -c /path/to/other/dir

# Send command with safety delay
tmux send-keys -t work:0 "npm start" Enter
sleep 0.5
tmux send-keys -t work:0 "status" Enter
```

### Capture Output for Verification
```bash
# Capture last 20 lines of pane output
OUTPUT=$(tmux capture-pane -p -t work:0 -S -20)
echo "$OUTPUT"   # Log or parse
```

### Control Mode Detection (iTerm2)
```bash
# Check if running in control mode
if [[ "$TERM" == "iterm2" ]] || [[ -n "$TMUX_CONTROL_MODE" ]]; then
    # Use control-mode-aware logic
    echo "Running in iTerm2 control mode"
fi
```

---

## References

- [tmux(1) Manual Page](https://man7.org/linux/man-pages/man1/tmux.1.html)
- [GitHub: tmux/tmux Wiki](https://github.com/tmux/tmux/wiki)
- [GitHub: Control Mode](https://github.com/tmux/tmux/wiki/Control-Mode)
- [iTerm2 tmux Integration](https://iterm2.com/documentation-tmux-integration.html)
- [Tao of tmux: Scripting](https://tao-of-tmux.readthedocs.io/en/latest/manuscript/10-scripting.html)
- [Claude Code Agent Teams Issues](https://github.com/anthropics/claude-code/issues?q=label:agent-teams)

