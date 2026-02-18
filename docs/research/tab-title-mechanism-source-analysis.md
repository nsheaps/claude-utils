# Source Analysis: How Claude Code Sets Terminal/Tab Titles

**Researcher**: Road Runner (Deep Researcher)
**Date**: 2026-02-18
**Source**: Decompiled Claude Code binary v2.0.74 at `~/src/nsheaps/cc-investigation/`
**Question**: What mechanism controls the tab title text visible in iTerm2 when running Claude Code agent teams?

## Executive Summary

Claude Code **DOES set terminal titles** via **OSC 0 escape sequences** (`\x1B]0;<title>\x07`), and it uses an **LLM call** to dynamically generate 2-3 word topic titles from each user message. This contradicts my previous research report which said Claude Code does NOT emit OSC escape sequences — it actually does, just through a mechanism that wasn't visible from external observation. The feature can be disabled via `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` environment variable.

## The Mechanism (from decompiled source)

### 1. Title-Setting Function: `Y7A` (line 174556)

```javascript
function Y7A(toolLinuxDef) {
    if (OA(process.env.CLAUDE_CODE_DISABLE_TERMINAL_TITLE)) return;
    process.stdout.write(`\x1B]0;${toolLinuxDef ? `✳ ${toolLinuxDef}` : ""}\x07`);
}
```

- Writes **OSC 0** (`\x1B]0;...\x07`) to `process.stdout`
- OSC 0 sets both the **window title** and **icon name** in most terminals
- Prefixes with `✳` (U+2733, eight-spoked asterisk) as visual indicator
- **Can be disabled** with `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1` env var
- Empty string clears the title

### 2. Topic Extraction Function: `uf_` (line 174560)

```javascript
async function uf_(toolLinuxDef) {
    if (toolLinuxDef.startsWith("<local-command-stdout>")) return;
    let errorHandler_R = "{";
    try {
        let errorHandler_A = await XJ({
            systemPrompt: [
                "Analyze if this message indicates a new conversation topic. " +
                "If it does, extract a 2-3 word title that captures the new topic. " +
                "Format your response as a JSON object with two fields: " +
                "'isNewTopic' (boolean) and 'title' (string, or null if isNewTopic is false). " +
                "Only include these fields, no other text. " +
                "ONLY generate the JSON object, no other text (eg. no markdown)."
            ],
            userPrompt: toolLinuxDef,
            assistantPrompt: errorHandler_R,
            signal: new AbortController().signal,
            options: {
                querySource: "terminal_update_title",
                agents: [],
                isNonInteractiveSession: false,
                hasAppendSystemPrompt: false,
                mcpTools: []
            }
        }),
        // Parse response, extract title
        _ = errorHandler_R + errorHandler_A.message.content
            .filter(D => D.type === "text")
            .map(D => D.text)
            .join(""),
        B = jH(_); // JSON parse
        if (B && typeof B === "object" && "isNewTopic" in B && "title" in B) {
            if (B.isNewTopic && B.title) Y7A(B.title);
        }
    } catch (errorHandler_A) {
        t(errorHandler_A);
    }
}
```

- Makes a **lightweight LLM call** (query source: `terminal_update_title`)
- System prompt asks for a JSON object: `{isNewTopic: boolean, title: string|null}`
- Only triggers title update if `isNewTopic` is true AND `title` is non-null
- Skips messages that start with `<local-command-stdout>` (command output)
- Uses `assistantPrompt: "{"` to pre-seed JSON output format

### 3. Call Sites

| Location | Code | Purpose |
|:---------|:-----|:--------|
| Line 366457 | `if (K7?.type === "user" && typeof K7.message.content === "string") uf_(K7.message.content)` | Triggers on each user message |
| Line 174580 | `if (B.isNewTopic && B.title) Y7A(B.title)` | Sets title when new topic detected |
| Line 358624 | `Y7A(""), o7(0)` | Clears title on session cleanup |

### 4. Process Title (separate from terminal title)

```javascript
// Line 418664
process.title = "claude";
```

- Set once at startup to `"claude"`
- This is the **Node.js process title** (what `ps` shows)
- tmux's `automatic-rename` reads THIS, producing "claude" as the window name
- This is SEPARATE from the OSC 0 terminal title

## How This Explains the Tab Titles

### What the User Saw (Screenshot 8.40.05 PM)

The iTerm2 tab sidebar showed titles like:
- "Broadcasting Rule Verification"
- "Guess-then-broadcast pattern"
- "QA Migration Fixes"
- "Orchestrator permissions leak"

**These are LLM-generated topic summaries** from the `uf_` function. When each agent received a user message (or team lead message), Claude Code made an LLM call to extract a 2-3 word topic, then set it as the terminal title via OSC 0.

### For Agent Teams Specifically

Each teammate runs in its own tmux pane with its own `process.stdout`. When the teammate's Claude Code instance receives a message and the LLM extracts a topic, it writes OSC 0 to that pane's stdout. In `tmux -CC` mode, iTerm2 picks up the OSC 0 title and displays it in the tab sidebar.

**This means**:
1. Titles are **dynamic** — they change as the conversation topic changes
2. Titles are **LLM-generated** — not from `activeForm` or task subjects
3. Titles come from the **user/lead message content**, not the agent's response
4. Each pane has its **own title** because each has its own Claude Code process

## Key Environment Variables

| Variable | Purpose |
|:---------|:--------|
| `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` | Set to disable OSC 0 title setting entirely |
| `CLAUDE_CODE_AGENT_NAME` | Available for agent identity (line 270156) but NOT used for titles |
| `CLAUDE_CODE_AGENT_TYPE` | Fallback for agent name (line 270156) but NOT used for titles |

## Notification System (Related but Different)

Claude Code also uses terminal notifications (NOT titles):

| Sequence | Function | Purpose |
|:---------|:---------|:--------|
| OSC 9 | `gf_()` (line 276639) | iTerm2 Growl notification |
| OSC 99 | `TCB()` (line 276650) | iTerm2 rich notification (title + body + focus) |
| OSC 777 | `Ud7()` (line 276659) | rxvt-unicode notification |
| BEL (`\x07`) | `xZA()` (line 276663) | Terminal bell |

The default notification title is "Claude Code" (line 276650: `${errorHandler_R || "Claude Code"}`).

## Corrections to Previous Research

My earlier report (`.claude/tmp/tab-title-mechanism-research.md`) stated:

> "Claude Code **does NOT natively set tmux window names or pane titles** for agent team teammates."

**This is WRONG.** Claude Code DOES set terminal titles via OSC 0 escape sequences. The confusion arose because:

1. Multiple GitHub issues (#18326, #20441, #15802, #15082) request this feature — but those are from older versions. The feature may have been added since those issues were filed.
2. The decompiled binary is v2.0.74. The feature exists in this version.
3. The OSC 0 sequence goes through `process.stdout`, which in a tmux pane is forwarded to the terminal. In `tmux -CC` mode, iTerm2 receives it.
4. The `automatic-rename` behavior from tmux uses `process.title` (set to "claude"), while the TAB title uses OSC 0 (set to the LLM-generated topic). These are different mechanisms.

## Implications for Agent Teams

### How to Control Tab Titles

1. **Let it work naturally**: Each agent's tab title will reflect the LLM-generated topic from the most recent user/lead message
2. **Force a specific title**: Send a message to the agent that the LLM will extract a meaningful topic from (e.g., "Work on: Authentication Bug Fix")
3. **Disable**: Set `CLAUDE_CODE_DISABLE_TERMINAL_TITLE=1` in the agent's environment
4. **Override manually**: After disabling, use `printf '\033]0;Custom Title\007'` from a hook

### For the Orchestrator

The orchestrator can influence teammate tab titles by sending descriptive messages. The first message to each teammate should include a clear topic description that the `terminal_update_title` LLM call will extract.

### Limitations

- Titles are based on the **latest** user message topic — they will change as the conversation progresses
- There's no way to "pin" a title without disabling the automatic feature
- The LLM call adds a small cost/latency per user message
- In agent teams, teammate titles reflect the LEAD's message topics to that teammate

## Confidence Levels

| Finding | Confidence |
|:--------|:-----------|
| OSC 0 escape sequence sets terminal/tab title | Very High — found exact code in decompiled source |
| LLM call generates 2-3 word topic titles | Very High — full system prompt extracted |
| `CLAUDE_CODE_DISABLE_TERMINAL_TITLE` disables it | Very High — explicit env var check in code |
| Triggers on each user message (string content) | Very High — call site at line 366457 |
| `process.title = "claude"` is separate (for ps/tmux auto-rename) | Very High — line 418664 |
| Feature exists in v2.0.74 (may not in older versions) | High — confirmed in this binary |
| Previous research was incorrect about OSC not being emitted | Very High — code proves otherwise |

## Sources

- Decompiled Claude Code binary v2.0.74 at `/Users/nathan.heaps/src/nsheaps/cc-investigation/src/decompiled/unbundled-full/claude-renamed.js`
  - Line 174556: `Y7A` function — OSC 0 title setter
  - Line 174560: `uf_` function — LLM-based topic extraction
  - Line 174580: Title update trigger (isNewTopic && title)
  - Line 358624: Title clear on cleanup
  - Line 366457: Call site on user message
  - Line 418664: `process.title = "claude"` (separate from OSC)
  - Line 270156: `CLAUDE_CODE_AGENT_NAME` / `CLAUDE_CODE_AGENT_TYPE` env vars
  - Line 276650: OSC 99 notification system
- [OSC 0 Terminal Title Standard](https://invisible-island.net/xterm/ctlseqs/ctlseqs.html#h3-Operating-System-Commands)
- [iTerm2 Proprietary Escape Codes](https://iterm2.com/documentation-escape-codes.html)
