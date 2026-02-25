# Hook Conversion Guide

Convert hooks between Claude Code and OpenCode formats while preserving lifecycle event semantics.

## Claude Code Hook Events → OpenCode Events

| Claude Code | OpenCode | Semantics |
|-------------|----------|-----------|
| PreToolUse | tool.execute.before / beforeTool | Before tool invocation |
| PostToolUse | tool.execute.after / afterTool | After successful tool execution |
| PostToolUseFailure | session.error / afterToolError | After tool execution fails |
| UserPromptSubmit | tui.prompt.append / beforePrompt | Before processing user input |
| SessionStart | session.created / sessionStart | At session initialization |
| SessionEnd | session.deleted / sessionEnd | When session ends |
| Stop | session.deleted / sessionEnd | During shutdown (merge with SessionEnd) |
| Notification | tui.toast.show / notification | System notifications |
| TeammateIdle | session.idle / idle | Agent/teammate becomes idle |
| TaskCompleted | (custom event) / taskComplete | Task marked complete |
| PermissionRequest | permission.asked / permissionCheck | Tool permission requested |
| PreCompact | experimental.session.compacting / beforeCompact | Before context compaction |
| Compact | session.compacted / afterCompact | After context compaction |

## Claude Code Hook Format

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/script.sh"
          }
        ]
      }
    ]
  }
}
```

## OpenCode Hook Format

```typescript
// .opencode/plugins/hooks.ts
export const HooksPlugin = async ({ client }) => {
  client.event.subscribe("tool.execute.before", async (event) => {
    // Handle pre-tool event
  });

  client.event.subscribe("tool.execute.after", async (event) => {
    // Handle post-tool event
  });
};
```

## Key Differences

1. **Matchers**: Claude Code uses regex matchers on tool names; OpenCode filters by event type
2. **I/O Format**: Claude Code passes JSON on stdin/stdout; OpenCode uses event objects
3. **Permission Control**: Claude Code returns `permissionDecision`; OpenCode uses `permission.replied`
4. **Execution**: Claude Code runs shell commands; OpenCode uses TypeScript handlers (can also shell out)

## Conversion Strategy

When converting Claude Code → OpenCode:
- Each `PreToolUse` matcher becomes a `tool.execute.before` subscription
- Shell commands are wrapped in `execSync()` calls
- Permission decisions map to event replies

When converting OpenCode → Claude Code:
- Event subscriptions become hook matchers
- TypeScript handlers need shell wrappers (`bun run handler.ts`)
- Inline handlers need extraction to standalone scripts
