/**
 * Main conversion engine that orchestrates the full plugin conversion
 * between Claude Code and OpenCode formats.
 *
 * Supports three modes:
 * - full: Brand new conversion from scratch
 * - sync: Incremental sync of changes from source to target
 * - diff: Preview changes without applying them
 */

import { readFile, writeFile, stat, mkdir } from "fs/promises";
import { join } from "path";
import { createHash } from "crypto";

import { parseClaudeCodePlugin, serializeClaudeCodePlugin } from "../parsers/claude-code-parser";
import { parseOpenCodePlugin, serializeOpenCodePlugin } from "../parsers/open-code-parser";
import {
  convertClaudeHooksToOpenCode,
  convertOpenCodeHooksToClaude,
} from "./hook-converter";
import {
  convertClaudeMCPToOpenCode,
  convertOpenCodeMCPToClaude,
} from "./mcp-converter";
import {
  convertClaudeSkillsToOpenCode,
  convertOpenCodeSkillsToClaude,
} from "./skill-converter";
import {
  convertClaudeAgentsToOpenCode,
  convertOpenCodeAgentsToClaude,
} from "./agent-converter";
import {
  convertClaudeCommandsToOpenCode,
  convertOpenCodeCommandsToClaude,
} from "./command-converter";

import type {
  ConversionDirection,
  ConversionMode,
  ConversionResult,
  ConversionWarning,
  ChangeRecord,
  SyncState,
} from "../core/types/common";
import type { ClaudeCodePlugin } from "../core/types/claude-code";
import type { OpenCodePlugin } from "../core/types/open-code";

const SYNC_STATE_FILE = ".plugin-sync-state.json";

export class ConversionEngine {
  private warnings: ConversionWarning[] = [];
  private changes: ChangeRecord[] = [];

  async convert(
    sourcePath: string,
    outputPath: string,
    direction: ConversionDirection,
    mode: ConversionMode,
  ): Promise<ConversionResult> {
    this.warnings = [];
    this.changes = [];

    const startTime = Date.now();

    switch (mode) {
      case "full":
        await this.fullConversion(sourcePath, outputPath, direction);
        break;
      case "sync":
        await this.syncConversion(sourcePath, outputPath, direction);
        break;
      case "diff":
        await this.diffConversion(sourcePath, outputPath, direction);
        break;
    }

    return {
      success: !this.warnings.some((w) => w.severity === "error"),
      direction,
      mode,
      outputPath,
      warnings: this.warnings,
      changesApplied: this.changes,
      timestamp: new Date().toISOString(),
    };
  }

  // ── Full Conversion ──────────────────────────────────────────────

  private async fullConversion(
    sourcePath: string,
    outputPath: string,
    direction: ConversionDirection,
  ): Promise<void> {
    if (direction === "claude-to-opencode") {
      await this.claudeToOpenCode(sourcePath, outputPath);
    } else {
      await this.openCodeToClaude(sourcePath, outputPath);
    }

    // Save sync state for future incremental syncs
    await this.saveSyncState(sourcePath, outputPath, direction);
  }

  private async claudeToOpenCode(
    sourcePath: string,
    outputPath: string,
  ): Promise<void> {
    const plugin = await parseClaudeCodePlugin(sourcePath);

    // Convert each component
    const { hooks, warnings: hookWarnings } = convertClaudeHooksToOpenCode(
      plugin.hooks,
    );
    this.warnings.push(...hookWarnings);

    const { servers: mcpServers, warnings: mcpWarnings } =
      convertClaudeMCPToOpenCode(plugin.mcpServers);
    this.warnings.push(...mcpWarnings);

    const { instructions, warnings: skillWarnings } =
      convertClaudeSkillsToOpenCode(plugin.skills);
    this.warnings.push(...skillWarnings);

    const { agents, warnings: agentWarnings } =
      convertClaudeAgentsToOpenCode(plugin.agents);
    this.warnings.push(...agentWarnings);

    const { commands, warnings: cmdWarnings } =
      convertClaudeCommandsToOpenCode(plugin.commands);
    this.warnings.push(...cmdWarnings);

    // Build OpenCode plugin
    const openCodePlugin: OpenCodePlugin = {
      config: {
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        description: plugin.manifest.description,
        author: plugin.manifest.author
          ? typeof plugin.manifest.author === "string"
            ? plugin.manifest.author
            : plugin.manifest.author
          : undefined,
        hooks,
        mcpServers,
        commands,
        agents,
        environment: plugin.settings?.env,
      },
      instructions,
      commands,
      hooks,
      mcpServers,
      agents,
      rootPath: outputPath,
    };

    await serializeOpenCodePlugin(openCodePlugin, outputPath);

    this.changes.push({
      type: "added",
      component: "plugin",
      targetPath: outputPath,
      description: `Converted Claude Code plugin "${plugin.manifest.name}" to OpenCode format`,
    });
  }

  private async openCodeToClaude(
    sourcePath: string,
    outputPath: string,
  ): Promise<void> {
    const plugin = await parseOpenCodePlugin(sourcePath);

    // Convert each component
    const { hooks, warnings: hookWarnings } = convertOpenCodeHooksToClaude(
      plugin.hooks,
    );
    this.warnings.push(...hookWarnings);

    const { servers: mcpServers, warnings: mcpWarnings } =
      convertOpenCodeMCPToClaude(plugin.mcpServers);
    this.warnings.push(...mcpWarnings);

    const { skills, warnings: skillWarnings } =
      convertOpenCodeSkillsToClaude(plugin.instructions);
    this.warnings.push(...skillWarnings);

    const { agents, warnings: agentWarnings } =
      convertOpenCodeAgentsToClaude(plugin.agents);
    this.warnings.push(...agentWarnings);

    const { commands, warnings: cmdWarnings } =
      convertOpenCodeCommandsToClaude(plugin.commands);
    this.warnings.push(...cmdWarnings);

    // Build Claude Code plugin
    const claudePlugin: ClaudeCodePlugin = {
      manifest: {
        name: plugin.config.name,
        version: plugin.config.version,
        description: plugin.config.description,
        author:
          typeof plugin.config.author === "string"
            ? { name: plugin.config.author }
            : plugin.config.author,
        repository: undefined,
        keywords: undefined,
      },
      skills,
      commands,
      agents,
      hooks,
      mcpServers,
      settings: plugin.config.environment
        ? { env: plugin.config.environment }
        : undefined,
      rootPath: outputPath,
    };

    await serializeClaudeCodePlugin(claudePlugin, outputPath);

    this.changes.push({
      type: "added",
      component: "plugin",
      targetPath: outputPath,
      description: `Converted OpenCode plugin "${plugin.config.name}" to Claude Code format`,
    });
  }

  // ── Sync Conversion ──────────────────────────────────────────────

  private async syncConversion(
    sourcePath: string,
    outputPath: string,
    direction: ConversionDirection,
  ): Promise<void> {
    // Load previous sync state
    const syncState = await this.loadSyncState(outputPath);

    if (!syncState) {
      // No previous sync; do full conversion
      this.warnings.push({
        severity: "info",
        component: "sync",
        message: "No previous sync state found; performing full conversion",
      });
      await this.fullConversion(sourcePath, outputPath, direction);
      return;
    }

    // Compare current source hash with last sync
    const currentHash = await this.hashDirectory(sourcePath);
    if (currentHash === syncState.sourceHash) {
      this.warnings.push({
        severity: "info",
        component: "sync",
        message: "Source has not changed since last sync; nothing to do",
      });
      return;
    }

    // Detect which components changed
    const componentChanges = await this.detectComponentChanges(
      sourcePath,
      syncState,
      direction,
    );

    if (componentChanges.length === 0) {
      this.warnings.push({
        severity: "info",
        component: "sync",
        message: "No component-level changes detected",
      });
      return;
    }

    // Re-convert only changed components
    for (const component of componentChanges) {
      this.changes.push({
        type: "modified",
        component,
        sourcePath,
        targetPath: outputPath,
        description: `Synced changes to ${component}`,
      });
    }

    // For now, do a full re-conversion (incremental per-component is complex)
    // The sync state tracking enables future optimization
    await this.fullConversion(sourcePath, outputPath, direction);

    // Update sync state
    await this.saveSyncState(sourcePath, outputPath, direction);
  }

  // ── Diff Mode ────────────────────────────────────────────────────

  private async diffConversion(
    sourcePath: string,
    _outputPath: string,
    direction: ConversionDirection,
  ): Promise<void> {
    // Parse source without writing anything
    if (direction === "claude-to-opencode") {
      const plugin = await parseClaudeCodePlugin(sourcePath);
      this.describePendingChanges(plugin, direction);
    } else {
      const plugin = await parseOpenCodePlugin(sourcePath);
      this.describePendingChanges(plugin, direction);
    }
  }

  private describePendingChanges(
    plugin: ClaudeCodePlugin | OpenCodePlugin,
    direction: ConversionDirection,
  ): void {
    const isClaudeSource = direction === "claude-to-opencode";
    const sourceName = isClaudeSource ? "Claude Code" : "OpenCode";
    const targetName = isClaudeSource ? "OpenCode" : "Claude Code";

    if (isClaudeSource) {
      const cp = plugin as ClaudeCodePlugin;
      if (cp.skills.length > 0) {
        this.changes.push({
          type: "added",
          component: "skills",
          description: `${cp.skills.length} skill(s) → ${targetName} instructions`,
        });
      }
      if (cp.commands.length > 0) {
        this.changes.push({
          type: "added",
          component: "commands",
          description: `${cp.commands.length} command(s) → TypeScript stubs`,
        });
      }
      if (cp.agents.length > 0) {
        this.changes.push({
          type: "added",
          component: "agents",
          description: `${cp.agents.length} agent(s) → ${targetName} agents`,
        });
      }
      if (Object.keys(cp.hooks).length > 0) {
        this.changes.push({
          type: "added",
          component: "hooks",
          description: `${Object.keys(cp.hooks).length} hook event(s) → plugin event handlers`,
        });
      }
      if (Object.keys(cp.mcpServers).length > 0) {
        this.changes.push({
          type: "added",
          component: "mcpServers",
          description: `${Object.keys(cp.mcpServers).length} MCP server(s) → ${targetName} config`,
        });
      }
    } else {
      const op = plugin as OpenCodePlugin;
      if (op.instructions.length > 0) {
        this.changes.push({
          type: "added",
          component: "instructions",
          description: `${op.instructions.length} instruction(s) → ${targetName} skills`,
        });
      }
      if (op.commands.length > 0) {
        this.changes.push({
          type: "added",
          component: "commands",
          description: `${op.commands.length} command(s) → markdown commands`,
        });
      }
      if (Object.keys(op.agents).length > 0) {
        this.changes.push({
          type: "added",
          component: "agents",
          description: `${Object.keys(op.agents).length} agent(s) → ${targetName} agents`,
        });
      }
      if (op.hooks.length > 0) {
        this.changes.push({
          type: "added",
          component: "hooks",
          description: `${op.hooks.length} hook(s) → settings.json hooks`,
        });
      }
      if (Object.keys(op.mcpServers).length > 0) {
        this.changes.push({
          type: "added",
          component: "mcpServers",
          description: `${Object.keys(op.mcpServers).length} MCP server(s) → .mcp.json`,
        });
      }
    }
  }

  // ── Sync State Management ────────────────────────────────────────

  private async saveSyncState(
    sourcePath: string,
    targetPath: string,
    direction: ConversionDirection,
  ): Promise<void> {
    const state: SyncState = {
      lastSyncTimestamp: new Date().toISOString(),
      sourceHash: await this.hashDirectory(sourcePath),
      targetHash: await this.hashDirectory(targetPath),
      direction,
      componentHashes: await this.hashComponents(sourcePath, direction),
    };

    await writeFile(
      join(targetPath, SYNC_STATE_FILE),
      JSON.stringify(state, null, 2) + "\n",
    );
  }

  private async loadSyncState(
    targetPath: string,
  ): Promise<SyncState | null> {
    try {
      const content = await readFile(
        join(targetPath, SYNC_STATE_FILE),
        "utf-8",
      );
      return JSON.parse(content) as SyncState;
    } catch {
      return null;
    }
  }

  private async detectComponentChanges(
    sourcePath: string,
    syncState: SyncState,
    direction: ConversionDirection,
  ): Promise<string[]> {
    const currentHashes = await this.hashComponents(sourcePath, direction);
    const changed: string[] = [];

    for (const [component, hash] of Object.entries(currentHashes)) {
      if (syncState.componentHashes[component] !== hash) {
        changed.push(component);
      }
    }

    return changed;
  }

  private async hashComponents(
    sourcePath: string,
    direction: ConversionDirection,
  ): Promise<Record<string, string>> {
    const hashes: Record<string, string> = {};
    const dirs =
      direction === "claude-to-opencode"
        ? ["skills", "commands", "agents", "hooks", ".mcp.json"]
        : ["instructions", "commands", ".opencode/agents", ".opencode/plugins"];

    for (const dir of dirs) {
      const fullPath = join(sourcePath, dir);
      try {
        await stat(fullPath);
        hashes[dir] = await this.hashPath(fullPath);
      } catch {
        hashes[dir] = "missing";
      }
    }

    return hashes;
  }

  private async hashDirectory(dirPath: string): Promise<string> {
    return this.hashPath(dirPath);
  }

  private async hashPath(path: string): Promise<string> {
    try {
      const info = await stat(path);
      // Use mtime as a quick proxy for content changes
      return createHash("sha256")
        .update(`${path}:${info.mtimeMs}:${info.size}`)
        .digest("hex")
        .slice(0, 16);
    } catch {
      return "missing";
    }
  }
}
