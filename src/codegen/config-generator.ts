/**
 * Generate configuration files (JSON) programmatically.
 *
 * Builds well-structured JSON for both OpenCode and Claude Code configs
 * without relying on string concatenation or AI.
 */

import type { ClaudeCodePlugin, ClaudeCodeHooks } from "../core/types/claude-code";
import type { OpenCodePlugin, OpenCodeMCPServers } from "../core/types/open-code";
import type { ClaudeCodeMCPServers } from "../core/types/claude-code";

// ── OpenCode Config Generator ────────────────────────────────────────

/**
 * Generate opencode.json from an OpenCode plugin definition.
 */
export function generateOpenCodeConfig(plugin: OpenCodePlugin): string {
  const config: Record<string, unknown> = {};

  // Basic metadata
  if (plugin.config.name) config.name = plugin.config.name;
  if (plugin.config.version) config.version = plugin.config.version;
  if (plugin.config.description) config.description = plugin.config.description;
  if (plugin.config.author) config.author = plugin.config.author;

  // Commands reference
  if (plugin.commands.length > 0) {
    config.commands = plugin.commands.map((cmd) => ({
      name: cmd.name,
      description: cmd.description,
      handler: cmd.handler || `commands/${cmd.name}.ts`,
      ...(cmd.aliases ? { aliases: cmd.aliases } : {}),
      ...(cmd.parameters ? { parameters: cmd.parameters } : {}),
    }));
  }

  // Agents reference
  if (Object.keys(plugin.agents).length > 0) {
    const agents: Record<string, unknown> = {};
    for (const [name, agent] of Object.entries(plugin.agents)) {
      agents[name] = {
        provider: agent.provider || "anthropic",
        model: agent.model || "claude-sonnet-4-20250514",
        instructions: `.opencode/agents/${name}.md`,
      };
    }
    config.agents = agents;
  }

  // MCP servers
  if (Object.keys(plugin.mcpServers).length > 0) {
    config.mcpServers = plugin.mcpServers;
  }

  // Environment
  if (plugin.config.environment) {
    config.environment = plugin.config.environment;
  }

  return JSON.stringify(config, null, 2) + "\n";
}

// ── Claude Code Config Generator ─────────────────────────────────────

/**
 * Generate .claude-plugin/plugin.json from a Claude Code plugin.
 */
export function generateClaudeManifest(plugin: ClaudeCodePlugin): string {
  const manifest: Record<string, unknown> = {};

  if (plugin.manifest.name) manifest.name = plugin.manifest.name;
  if (plugin.manifest.version) manifest.version = plugin.manifest.version;
  if (plugin.manifest.description) manifest.description = plugin.manifest.description;
  if (plugin.manifest.author) manifest.author = plugin.manifest.author;
  if (plugin.manifest.repository) manifest.repository = plugin.manifest.repository;
  if (plugin.manifest.keywords) manifest.keywords = plugin.manifest.keywords;

  return JSON.stringify(manifest, null, 2) + "\n";
}

/**
 * Generate .mcp.json from MCP server configuration.
 */
export function generateMCPConfig(servers: ClaudeCodeMCPServers | OpenCodeMCPServers): string {
  return JSON.stringify({ mcpServers: servers }, null, 2) + "\n";
}

/**
 * Generate hooks/hooks.json from Claude Code hooks config.
 */
export function generateHooksConfig(hooks: ClaudeCodeHooks): string {
  return JSON.stringify({ hooks }, null, 2) + "\n";
}

/**
 * Generate settings.json from Claude Code settings.
 */
export function generateSettingsJSON(settings: Record<string, unknown>): string {
  // Filter out hooks (they go in hooks/hooks.json) and empty values
  const filtered: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (key !== "hooks" && value !== undefined && value !== null) {
      filtered[key] = value;
    }
  }

  if (Object.keys(filtered).length === 0) return "";
  return JSON.stringify(filtered, null, 2) + "\n";
}
