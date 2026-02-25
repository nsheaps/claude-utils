/**
 * Type definitions for Open Code (sst/opencode) configuration format.
 *
 * OpenCode uses a different configuration structure based on:
 * - opencode.json / opencode.yaml config file
 * - Custom hook/event system with different naming conventions
 * - MCP server definitions (similar but different transport config)
 * - Provider-agnostic model configuration
 */

// ── Provider Configuration ───────────────────────────────────────────

export interface OpenCodeProvider {
  name: string;
  model: string;
  apiKey?: string;
  baseUrl?: string;
  options?: Record<string, unknown>;
}

// ── Hook System ──────────────────────────────────────────────────────

export type OpenCodeHookEvent =
  | "beforeTool"
  | "afterTool"
  | "afterToolError"
  | "beforePrompt"
  | "afterPrompt"
  | "sessionStart"
  | "sessionEnd"
  | "notification"
  | "idle"
  | "taskComplete"
  | "permissionCheck"
  | "beforeCompact"
  | "afterCompact";

export interface OpenCodeHookConfig {
  event: OpenCodeHookEvent;
  pattern?: string; // tool name pattern (glob or regex)
  command?: string; // shell command to run
  script?: string; // path to script file
  handler?: string; // TypeScript/JavaScript handler path
  timeout?: number;
  environment?: Record<string, string>;
}

export interface OpenCodeHookInput {
  sessionId: string;
  workingDirectory: string;
  eventName: OpenCodeHookEvent;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolCallId?: string;
  provider?: string;
  model?: string;
}

export interface OpenCodeHookOutput {
  action?: "allow" | "deny" | "prompt";
  reason?: string;
  modifiedInput?: Record<string, unknown>;
}

// ── MCP Server Configuration ─────────────────────────────────────────

export interface OpenCodeMCPServer {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  timeout?: number;
  transport?: "stdio" | "http" | "websocket";
  url?: string; // for http/websocket transport
}

export type OpenCodeMCPServers = Record<string, OpenCodeMCPServer>;

// ── Custom Instructions / Skills ─────────────────────────────────────

export interface OpenCodeInstruction {
  name: string;
  path: string;
  content: string;
  triggers?: string[]; // activation triggers (like slash commands)
}

// ── Commands ─────────────────────────────────────────────────────────

export interface OpenCodeCommand {
  name: string;
  aliases?: string[];
  description: string;
  handler: string; // path to handler script/module
  parameters?: Array<{
    name: string;
    type: string;
    description: string;
    required?: boolean;
  }>;
}

// ── Agents / Assistants ──────────────────────────────────────────────

export interface OpenCodeAgent {
  name: string;
  description?: string;
  provider: string;
  model: string;
  instructions: string; // system prompt or path to file
  tools?: string[]; // allowed tool names
  mcpServers?: string[]; // which MCP servers this agent can use
}

// ── Complete Configuration ───────────────────────────────────────────

export interface OpenCodeConfig {
  name: string;
  version?: string;
  description?: string;
  author?: string | { name: string; email?: string; url?: string };

  providers?: Record<string, OpenCodeProvider>;
  defaultProvider?: string;
  defaultModel?: string;

  hooks?: OpenCodeHookConfig[];
  mcpServers?: OpenCodeMCPServers;
  instructions?: OpenCodeInstruction[];
  commands?: OpenCodeCommand[];
  agents?: Record<string, OpenCodeAgent>;

  tools?: {
    allowed?: string[];
    blocked?: string[];
  };

  environment?: Record<string, string>;
}

// ── Plugin Package ───────────────────────────────────────────────────

export interface OpenCodePlugin {
  config: OpenCodeConfig;
  instructions: OpenCodeInstruction[];
  commands: OpenCodeCommand[];
  hooks: OpenCodeHookConfig[];
  mcpServers: OpenCodeMCPServers;
  agents: Record<string, OpenCodeAgent>;
  rootPath: string;
}

// ── Marketplace Entry ────────────────────────────────────────────────

export interface OpenCodeMarketplaceEntry {
  name: string;
  version: string;
  description: string;
  author: string;
  repository: string;
  keywords?: string[];
  pluginPath: string;
  compatibility?: {
    opencode?: string;
    claudeCode?: string; // original Claude Code version if converted
  };
}

export interface OpenCodeMarketplace {
  entries: OpenCodeMarketplaceEntry[];
  rootPath: string;
}
