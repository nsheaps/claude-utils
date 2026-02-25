/**
 * Converts MCP server configurations between Claude Code and OpenCode.
 *
 * Both formats support MCP servers, but OpenCode adds transport type
 * and URL fields for non-stdio transports.
 */

import type { ClaudeCodeMCPServers, ClaudeCodeMCPServer } from "../core/types/claude-code";
import type { OpenCodeMCPServers, OpenCodeMCPServer } from "../core/types/open-code";
import type { ConversionWarning } from "../core/types/common";

// ── Claude Code → OpenCode ───────────────────────────────────────────

export function convertClaudeMCPToOpenCode(
  servers: ClaudeCodeMCPServers,
): { servers: OpenCodeMCPServers; warnings: ConversionWarning[] } {
  const result: OpenCodeMCPServers = {};
  const warnings: ConversionWarning[] = [];

  for (const [name, server] of Object.entries(servers)) {
    const converted: OpenCodeMCPServer = {
      command: server.command,
      args: server.args,
      env: server.env,
      timeout: server.timeout,
      transport: "stdio", // Claude Code defaults to stdio
    };

    // Detect if command suggests a network transport
    if (
      server.command.includes("http") ||
      server.args?.some((a) => a.includes("http"))
    ) {
      converted.transport = "http";
      const urlArg = server.args?.find((a) =>
        a.startsWith("http://") || a.startsWith("https://"),
      );
      if (urlArg) {
        converted.url = urlArg;
      }
      warnings.push({
        severity: "info",
        component: "mcpServers",
        message: `MCP server "${name}" appears to use HTTP transport; verify the URL configuration`,
      });
    }

    // Handle CLAUDE_PLUGIN_ROOT variable substitution
    if (server.command.includes("${CLAUDE_PLUGIN_ROOT}")) {
      converted.command = server.command.replace(
        /\$\{CLAUDE_PLUGIN_ROOT\}/g,
        "${OPENCODE_PLUGIN_ROOT}",
      );
      warnings.push({
        severity: "info",
        component: "mcpServers",
        message: `MCP server "${name}" uses CLAUDE_PLUGIN_ROOT; mapped to OPENCODE_PLUGIN_ROOT`,
        suggestion: `Verify the OPENCODE_PLUGIN_ROOT environment variable is set correctly`,
      });
    }

    if (server.args) {
      converted.args = server.args.map((arg) =>
        arg.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, "${OPENCODE_PLUGIN_ROOT}"),
      );
    }

    if (server.env) {
      converted.env = Object.fromEntries(
        Object.entries(server.env).map(([k, v]) => [
          k,
          v.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, "${OPENCODE_PLUGIN_ROOT}"),
        ]),
      );
    }

    result[name] = converted;
  }

  return { servers: result, warnings };
}

// ── OpenCode → Claude Code ───────────────────────────────────────────

export function convertOpenCodeMCPToClaude(
  servers: OpenCodeMCPServers,
): { servers: ClaudeCodeMCPServers; warnings: ConversionWarning[] } {
  const result: ClaudeCodeMCPServers = {};
  const warnings: ConversionWarning[] = [];

  for (const [name, server] of Object.entries(servers)) {
    // Claude Code only supports stdio transport natively
    if (server.transport && server.transport !== "stdio") {
      warnings.push({
        severity: "warning",
        component: "mcpServers",
        message: `MCP server "${name}" uses "${server.transport}" transport which Claude Code doesn't natively support`,
        suggestion: `Use a stdio proxy wrapper or configure via Streamable HTTP transport`,
      });
    }

    const converted: ClaudeCodeMCPServer = {
      command: server.command,
      args: server.args,
      env: server.env,
      timeout: server.timeout,
    };

    // Handle OPENCODE_PLUGIN_ROOT substitution
    if (server.command.includes("${OPENCODE_PLUGIN_ROOT}")) {
      converted.command = server.command.replace(
        /\$\{OPENCODE_PLUGIN_ROOT\}/g,
        "${CLAUDE_PLUGIN_ROOT}",
      );
    }

    if (server.args) {
      converted.args = server.args.map((arg) =>
        arg.replace(/\$\{OPENCODE_PLUGIN_ROOT\}/g, "${CLAUDE_PLUGIN_ROOT}"),
      );
    }

    if (server.env) {
      converted.env = Object.fromEntries(
        Object.entries(server.env).map(([k, v]) => [
          k,
          v.replace(/\$\{OPENCODE_PLUGIN_ROOT\}/g, "${CLAUDE_PLUGIN_ROOT}"),
        ]),
      );
    }

    result[name] = converted;
  }

  return { servers: result, warnings };
}
