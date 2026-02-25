# MCP Server Conversion Guide

Convert MCP (Model Context Protocol) server configurations between Claude Code and OpenCode.

## Configuration Locations

| Format | File | Key |
|--------|------|-----|
| Claude Code | `.mcp.json` | `mcpServers` |
| Claude Code | `settings.json` | `mcpServers` |
| OpenCode | `opencode.json` | `mcpServers` |

## Claude Code MCP Format

```json
{
  "mcpServers": {
    "my-server": {
      "command": "uvx",
      "args": ["mcp-server-filesystem", "/home/user"],
      "env": { "API_KEY": "..." },
      "timeout": 30000
    }
  }
}
```

## OpenCode MCP Format

```json
{
  "mcpServers": {
    "my-server": {
      "command": "uvx",
      "args": ["mcp-server-filesystem", "/home/user"],
      "env": { "API_KEY": "..." },
      "timeout": 30000,
      "transport": "stdio",
      "url": null
    }
  }
}
```

## Key Differences

1. **Transport**: OpenCode explicitly specifies transport type (`stdio`, `http`, `websocket`)
2. **URL field**: OpenCode supports `url` for HTTP/WebSocket transports
3. **Variable substitution**: Claude Code uses `${CLAUDE_PLUGIN_ROOT}`; OpenCode uses `${OPENCODE_PLUGIN_ROOT}`
4. **CLI registration**: Claude Code has `claude mcp add`; OpenCode uses config file only

## Conversion Notes

- Most MCP servers use stdio transport and convert 1:1
- HTTP/WebSocket transports in OpenCode need proxy wrappers in Claude Code
- Environment variable names should be mapped appropriately
- Timeout values are preserved as-is (both use milliseconds)
