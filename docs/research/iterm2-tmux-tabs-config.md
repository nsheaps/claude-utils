# Configuring iTerm2 tmux Integration: Open tmux Windows as Tabs

## Executive Summary

iTerm2's tmux integration (`tmux -CC` control mode) can be configured to open new tmux windows as **native iTerm2 tabs** in the same window, rather than as separate windows. The primary setting is a dropdown found at **Settings > General > tmux** labeled **"When attaching, restore windows as"** (in older versions labeled **"Open tmux windows as"**). Set this to **"Native tabs"** to get the desired behavior.


---

## Step-by-Step Configuration

### Step 1: Open iTerm2 Settings

* **macOS Ventura+**: iTerm2 menu > **Settings...** (or press `Cmd+,`)
* **Older macOS**: iTerm2 menu > **Preferences...**

### Step 2: Navigate to the tmux Section


1. Click the **General** tab (top bar)
2. Click the **tmux** sub-tab (in the left sidebar or sub-navigation)

### Step 3: Change the "When attaching, restore windows as" Dropdown

This is the **first dropdown** in the tmux Integration section. It controls how tmux windows are mapped to native iTerm2 constructs.

**Available options** (confirmed from iTerm2 GitLab issues and documentation):

| Dropdown Option | Behavior |
|----|----|
| **Native windows** | Each tmux window becomes a separate iTerm2 window. This is the default. |
| **Native tabs** | Each tmux window becomes a tab in the **same** iTerm2 window. **This is what you want.** |
| **Native tabs in a new window** | Each tmux window becomes a tab, but they all open in a **new** iTerm2 window (not the existing one). |

**Select "Native tabs"** to have all tmux windows appear as tabs in the same iTerm2 window.

### Step 4: Configure Related Settings (Recommended)

While in **Settings > General > tmux**, also consider these settings:

| Setting | Recommended Value | Description |
|----|----|----|
| **Automatically bury the tmux client session after connecting** | Enabled (checked) | When you run `tmux -CC`, the window where you typed the command gets "buried" (hidden) so it doesn't clutter your tab bar. Access buried sessions via Window > Buried Sessions. |
| **Use "tmux" profile rather than profile of connecting session** | Disabled (default since v3.3) | When disabled, tmux sessions inherit the profile of the session where you ran `tmux -CC`. When enabled, a dedicated "tmux" profile (copy of Default) is used for all tmux sessions. |
| **Status bar shows tmux status bar content, not native components** | Your preference | When enabled, the iTerm2 status bar mirrors the tmux status bar. When disabled, uses your profile's status bar configuration. |
| **Open dashboard if there are more than N tmux windows** | 10 (default) | If a tmux session has more windows than this threshold, the tmux Dashboard opens instead of auto-opening all windows. Adjust upward if you routinely have many windows. |
| **Mirror tmux paste buffer to local clipboard** | Your preference | Syncs the tmux paste buffer with the macOS system clipboard. |

### Step 5: Advanced Setting (If Needed)

There is an additional advanced setting that may affect behavior:


1. Go to **Settings > Advanced**
2. Search for **"tmux"** in the search/filter box
3. Find: **"Should new tmux windows not created by iTerm2 open in the current window"**
   * Set to **Yes** to have tmux windows created externally (e.g., from another client or script) open as tabs in the current iTerm2 window
   * Set to **No** to have them open as separate windows (old behavior)

Also look for:

* **"Allow variable window sizes in tmux integration"** -- Useful if you have monitors of different sizes.


---

## tmux.conf Settings That Affect iTerm2 Integration

These `~/.tmux.conf` settings are recommended when using iTerm2 tmux integration:

```tmux
# Recommended: Set terminal type for proper color and feature support
set -g default-terminal "xterm-256color"

# Recommended: Enable window title propagation to iTerm2 tabs
set-option -g set-titles on
set-option -g set-titles-string '#T'

# Optional: Allow window renaming (useful for older tmux versions)
set -g allow-rename on
```

**Note:** No tmux.conf setting directly controls whether iTerm2 opens tmux windows as tabs vs windows. That is entirely an iTerm2-side preference.


---

## How to Use tmux -CC (Control Mode)

### Basic Local Usage

```bash
# Start a new session in control mode
tmux -CC

# Start or attach to a named session
tmux -CC new -A -s main

# Attach to an existing session
tmux -CC attach -t mysession
```

### Remote Usage via SSH

```bash
# SSH and start tmux control mode
ssh -t example.com 'tmux -CC new -A -s main'
```

### SSH Config for Auto-Launch

Add to `~/.ssh/config`:

```
Host myserver
    RequestTTY Yes
    RemoteCommand tmux -u -CC new-session -A -D -X -s main /bin/bash
```

### Shell Integration with tmux

Add to your shell profile (`.bashrc`, `.zshrc`) **before** shell integration loads:

```bash
export ITERM_ENABLE_SHELL_INTEGRATION_WITH_TMUX=YES
```


---

## Troubleshooting

### Problem: tmux windows still open as separate windows


1. **Verify the setting**: Go to Settings > General > tmux and confirm "When attaching, restore windows as" is set to "Native tabs"
2. **Check the advanced setting**: Settings > Advanced > search "tmux" > "Should new tmux windows not created by iTerm2 open in the current window" should be "Yes"
3. **Restart iTerm2**: Some settings require restarting iTerm2 to take effect
4. **Detach and reattach**: If already attached to a tmux session, detach (`tmux detach` or close the windows) and reconnect with `tmux -CC attach`

### Problem: "Automatically bury" loses the "tabs" setting

This was a known bug (GitLab issue [#6075](https://gitlab.com/gnachman/iterm2/-/issues/6075)). If the "Automatically bury the tmux client session after connecting" setting interferes with the tabs setting, try:

* Updating to the latest iTerm2 version
* Toggling the bury setting off and on
* Re-selecting "Native tabs" after changing the bury setting

### Problem: iTerm2 resizes on start with "native tabs" enabled

Known issue (GitLab issue [#3811](https://gitlab.com/gnachman/iterm2/-/issues/3811)). The workaround is to ensure your profile's default window size matches your typical terminal size, or update to a newer iTerm2 build where this is fixed.

### Problem: Cmd+N creates a tmux tab instead of a new iTerm2 window

When attached to a tmux session, Cmd+N creates a new tmux window (which appears as a tab). This is by design (GitLab issue [#6462](https://gitlab.com/gnachman/iterm2/-/issues/6462)). To create a new non-tmux iTerm2 window, use the **Shell > New Window** menu with a non-tmux profile, or detach from tmux first.

### Problem: Tabs open slowly / sequentially

When attaching to a session with many existing windows, iTerm2 opens tabs sequentially rather than simultaneously. This is expected behavior. You can increase the "Open dashboard if there are more than N windows" threshold or use the tmux Dashboard (Shell > tmux > Dashboard) to selectively open only the windows you need.

### Problem: vim-tmux-navigator doesn't work

The tmux integration changes how pane navigation works. Native iTerm2 pane navigation uses `Cmd+[` / `Cmd+]` instead of tmux prefix-based keybindings. vim-tmux-navigator will not work in its standard configuration with tmux integration mode.

### Problem: tmux status bar is missing

By default, iTerm2 replaces the tmux status bar with its own native interface. To see tmux status bar content, enable **"Status bar shows tmux status bar content, not native components"** in Settings > General > tmux.


---

## The tmux Dashboard

Access via **Shell > tmux > Dashboard** (or it opens automatically when you attach to a session with more windows than the configured threshold).

The Dashboard lets you:

* See all tmux windows and sessions
* Selectively open/close individual windows
* Choose which windows to display as tabs
* Manage multiple tmux sessions


---

## Quick Reference: Setting Paths

| What You Want | Where to Change It |
|----|----|
| tmux windows as tabs in same window | Settings > General > tmux > "When attaching, restore windows as" > **Native tabs** |
| External tmux windows as tabs too | Settings > Advanced > search "tmux" > "Should new tmux windows not created by iTerm2 open in the current window" > **Yes** |
| Hide the tmux -CC gateway session | Settings > General > tmux > "Automatically bury the tmux client session after connecting" > **Enabled** |
| Use a dedicated tmux profile | Settings > General > tmux > "Use tmux profile rather than profile of connecting session" > **Enabled** |
| Show tmux status bar | Settings > General > tmux > "Status bar shows tmux status bar content" > **Enabled** |
| Dashboard auto-open threshold | Settings > General > tmux > "Open dashboard if there are more than N tmux windows" |
| Variable window sizes | Settings > Advanced > search "variable window sizes in tmux" |


---

## Sources

* [iTerm2 tmux Integration Documentation](https://iterm2.com/documentation-tmux-integration.html)
* [iTerm2 General Preferences - tmux section (v3.4)](https://iterm2.com/3.4/documentation-preferences-general.html)
* [iTerm2 General Preferences (current)](https://iterm2.com/documentation-preferences-general.html)
* [iTerm2 One-Page Documentation](https://iterm2.com/documentation-one-page.html)
* [iTerm2 Preferences (v3.0)](https://iterm2.com/3.0/documentation-preferences.html)
* [iTerm2 Preferences (v3.1)](https://iterm2.com/3.1/documentation-preferences.html)
* [iTerm2 Preferences (v3.2)](https://iterm2.com/3.2/documentation-preferences.html)
* [tmux Integration Best Practices Wiki (GitLab)](https://gitlab.com/gnachman/iterm2/-/wikis/tmux-Integration-Best-Practices)
* [GitLab Issue #3811 - iTerm resizes with "open tmux windows as native tabs"](https://gitlab.com/gnachman/iterm2/-/issues/3811)
* [GitLab Issue #6075 - "Automatically bury" loses "Open tmux windows as tabs"](https://gitlab.com/gnachman/iterm2/-/issues/6075)
* [GitLab Issue #6462 - Cmd+N opens tmux tab instead of iTerm2 window](https://gitlab.com/gnachman/iterm2/-/issues/6462)
* [GitLab Issue #8488 - "Native tabs in a new window" option](https://gitlab.com/gnachman/iterm2/-/issues/8488)
* [Tmux iTerm Integration Tips and Best Practices (GitHub Gist)](https://gist.github.com/drofp/a0255cfb8b65e086039838f34dc43de0)
* [iTerm2 tmux Integration (trzsz guide)](https://trzsz.github.io/tmuxcc.html)
* [iTerm2 with tmux integration (blog.ngzhian.com)](https://blog.ngzhian.com/iterm2-tmux.html)
* [Google Groups: tmux integration - tabs instead of windows](https://groups.google.com/g/iterm2-discuss/c/SWd_cPiFYeE)
* [Google Groups: tmux integration - opening new tabs in current window](https://groups.google.com/g/iterm2-discuss/c/sbs45MiKX5U)


