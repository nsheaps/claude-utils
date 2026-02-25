/**
 * Common types shared across both Claude Code and Open Code plugin formats.
 * Used as intermediate representation for conversion.
 */

// ── Conversion Direction ─────────────────────────────────────────────

export type ConversionDirection = "claude-to-opencode" | "opencode-to-claude";

// ── Conversion Mode ──────────────────────────────────────────────────

export type ConversionMode =
  | "full" // Create a brand new conversion from scratch
  | "sync" // Incrementally sync changes from source to target
  | "diff"; // Show what would change without applying

// ── Unified Hook Event Mapping ───────────────────────────────────────

export interface HookEventMapping {
  claudeCode: string;
  openCode: string;
  description: string;
  bidirectional: boolean; // true if semantically equivalent in both
}

export const HOOK_EVENT_MAPPINGS: HookEventMapping[] = [
  {
    claudeCode: "PreToolUse",
    openCode: "beforeTool",
    description: "Fires before a tool is invoked",
    bidirectional: true,
  },
  {
    claudeCode: "PostToolUse",
    openCode: "afterTool",
    description: "Fires after a tool completes successfully",
    bidirectional: true,
  },
  {
    claudeCode: "PostToolUseFailure",
    openCode: "afterToolError",
    description: "Fires after a tool execution fails",
    bidirectional: true,
  },
  {
    claudeCode: "UserPromptSubmit",
    openCode: "beforePrompt",
    description: "Fires before processing user input",
    bidirectional: true,
  },
  {
    claudeCode: "SessionStart",
    openCode: "sessionStart",
    description: "Fires at session initialization",
    bidirectional: true,
  },
  {
    claudeCode: "SessionEnd",
    openCode: "sessionEnd",
    description: "Fires when session ends",
    bidirectional: true,
  },
  {
    claudeCode: "Notification",
    openCode: "notification",
    description: "Fires on system notifications",
    bidirectional: true,
  },
  {
    claudeCode: "TeammateIdle",
    openCode: "idle",
    description: "Fires when an agent/teammate becomes idle",
    bidirectional: true,
  },
  {
    claudeCode: "TaskCompleted",
    openCode: "taskComplete",
    description: "Fires when a task is marked complete",
    bidirectional: true,
  },
  {
    claudeCode: "PermissionRequest",
    openCode: "permissionCheck",
    description: "Fires when tool permission is requested",
    bidirectional: true,
  },
  {
    claudeCode: "PreCompact",
    openCode: "beforeCompact",
    description: "Fires before context compaction",
    bidirectional: true,
  },
  {
    claudeCode: "Compact",
    openCode: "afterCompact",
    description: "Fires after context compaction",
    bidirectional: true,
  },
  {
    claudeCode: "Stop",
    openCode: "sessionEnd",
    description: "Fires during shutdown (mapped to sessionEnd in OpenCode)",
    bidirectional: false,
  },
];

// ── Conversion Result ────────────────────────────────────────────────

export interface ConversionWarning {
  severity: "info" | "warning" | "error";
  component: string; // e.g., "hooks", "mcpServers", "skills"
  message: string;
  suggestion?: string;
}

export interface ConversionResult {
  success: boolean;
  direction: ConversionDirection;
  mode: ConversionMode;
  outputPath: string;
  warnings: ConversionWarning[];
  changesApplied: ChangeRecord[];
  timestamp: string;
}

export interface ChangeRecord {
  type: "added" | "modified" | "removed" | "renamed";
  component: string;
  sourcePath?: string;
  targetPath?: string;
  description: string;
}

// ── Diff State ───────────────────────────────────────────────────────

export interface SyncState {
  lastSyncTimestamp: string;
  sourceHash: string;
  targetHash: string;
  direction: ConversionDirection;
  componentHashes: Record<string, string>;
}

// ── Marketplace Operations ───────────────────────────────────────────

export interface MarketplaceConversionConfig {
  sourceDir: string;
  targetDir: string;
  direction: ConversionDirection;
  include?: string[]; // glob patterns for plugins to include
  exclude?: string[]; // glob patterns for plugins to exclude
  parallel?: number; // max parallel conversions
  continueOnError?: boolean;
  generateDocs?: boolean;
  runValidation?: boolean;
  runTests?: boolean;
}

export interface MarketplaceConversionReport {
  totalPlugins: number;
  converted: number;
  failed: number;
  skipped: number;
  warnings: number;
  results: Array<{
    plugin: string;
    result: ConversionResult;
  }>;
  timestamp: string;
  duration: number;
}
