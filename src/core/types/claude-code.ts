/**
 * Type definitions for Claude Code plugin format.
 *
 * Represents the structure of Claude Code plugins including:
 * - Plugin manifest (.claude-plugin/plugin.json)
 * - Hooks (PreToolUse, PostToolUse, SessionStart, etc.)
 * - MCP server configurations
 * - Skills, commands, agents
 * - Settings hierarchy
 */

// ── Plugin Manifest ──────────────────────────────────────────────────

export interface ClaudeCodePluginManifest {
  name: string;
  version?: string;
  description?: string;
  author?: {
    name: string;
    email?: string;
    url?: string;
  };
  homepage?: string;
  repository?: string;
  keywords?: string[];
  license?: string;
}

// ── Hook System ──────────────────────────────────────────────────────

export type ClaudeCodeHookEvent =
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "Notification"
  | "UserPromptSubmit"
  | "SessionStart"
  | "SessionEnd"
  | "Stop"
  | "TeammateIdle"
  | "TaskCompleted"
  | "PermissionRequest"
  | "PreCompact"
  | "Compact";

export interface ClaudeCodeHookCommand {
  type: "command";
  command: string;
  timeout?: number;
}

export interface ClaudeCodeHookMatcher {
  matcher: string; // regex pattern for tool matching
  hooks: ClaudeCodeHookCommand[];
}

export type ClaudeCodeHooks = {
  [K in ClaudeCodeHookEvent]?: ClaudeCodeHookMatcher[];
};

export interface ClaudeCodeHookInput {
  session_id: string;
  transcript_path: string;
  cwd: string;
  permission_mode: string;
  hook_event_name: ClaudeCodeHookEvent;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_use_id?: string;
}

export interface ClaudeCodeHookOutput {
  hookSpecificOutput?: {
    hookEventName: ClaudeCodeHookEvent;
    permissionDecision?: "allow" | "deny" | "ask";
    reason?: string;
  };
}

// ── MCP Server Configuration ─────────────────────────────────────────

export interface ClaudeCodeMCPServer {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  timeout?: number;
}

export type ClaudeCodeMCPServers = Record<string, ClaudeCodeMCPServer>;

// ── Skills ───────────────────────────────────────────────────────────

export interface ClaudeCodeSkill {
  name: string;
  path: string; // relative path to SKILL.md
  content: string; // markdown content
  references?: string[]; // paths to reference files
}

// ── Commands ─────────────────────────────────────────────────────────

export interface ClaudeCodeCommandParameter {
  name: string;
  type: string;
  description: string;
  required?: boolean;
}

export interface ClaudeCodeCommand {
  name: string;
  aliases?: string[];
  description: string;
  examples?: string[];
  parameters?: ClaudeCodeCommandParameter[];
  content: string; // markdown body
  path: string;
}

// ── Agents ───────────────────────────────────────────────────────────

export interface ClaudeCodeAgent {
  name: string;
  path: string;
  content: string; // markdown content
}

// ── Settings ─────────────────────────────────────────────────────────

export interface ClaudeCodeSettings {
  hooks?: ClaudeCodeHooks;
  mcpServers?: ClaudeCodeMCPServers;
  enabledPlugins?: Record<string, boolean>;
  env?: Record<string, string>;
  teammateMode?: "in-process" | "tmux" | "iterm2";
  skillsPath?: string;
  commandsPath?: string;
  agentsPath?: string;
  permissions?: Record<string, unknown>;
}

// ── Complete Plugin Structure ────────────────────────────────────────

export interface ClaudeCodePlugin {
  manifest: ClaudeCodePluginManifest;
  skills: ClaudeCodeSkill[];
  commands: ClaudeCodeCommand[];
  agents: ClaudeCodeAgent[];
  hooks: ClaudeCodeHooks;
  mcpServers: ClaudeCodeMCPServers;
  settings?: ClaudeCodeSettings;
  rootPath: string;
}

// ── Marketplace Entry ────────────────────────────────────────────────

export interface ClaudeCodeMarketplaceEntry {
  name: string;
  version: string;
  description: string;
  author: string;
  repository: string;
  keywords?: string[];
  pluginPath: string; // path within the marketplace repo
}

export interface ClaudeCodeMarketplace {
  entries: ClaudeCodeMarketplaceEntry[];
  rootPath: string;
}
