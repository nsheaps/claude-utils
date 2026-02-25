/**
 * Plugin validation utilities.
 *
 * Validates plugin structures for both Claude Code and OpenCode formats,
 * checking for required files, valid JSON, and structural correctness.
 */

import { readFile, stat } from "fs/promises";
import { join } from "path";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function isValidJson(path: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const content = await readFile(path, "utf-8");
    JSON.parse(content);
    return { valid: true };
  } catch (error) {
    return { valid: false, error: error instanceof Error ? error.message : String(error) };
  }
}

// ── Claude Code Plugin Validation ────────────────────────────────────

export async function validateClaudeCodePlugin(
  rootPath: string,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check manifest
  const manifestPath = join(rootPath, ".claude-plugin", "plugin.json");
  if (await pathExists(manifestPath)) {
    const jsonResult = await isValidJson(manifestPath);
    if (!jsonResult.valid) {
      errors.push(`Invalid plugin.json: ${jsonResult.error}`);
    } else {
      const content = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(content);
      if (!manifest.name) {
        errors.push('plugin.json missing required "name" field');
      }
    }
  } else {
    warnings.push("No .claude-plugin/plugin.json found; plugin will use directory name");
  }

  // Check for at least one component
  const hasSkills = await pathExists(join(rootPath, "skills"));
  const hasCommands = await pathExists(join(rootPath, "commands"));
  const hasAgents = await pathExists(join(rootPath, "agents"));
  const hasHooks = await pathExists(join(rootPath, "hooks"));
  const hasMcp = await pathExists(join(rootPath, ".mcp.json"));

  if (!hasSkills && !hasCommands && !hasAgents && !hasHooks && !hasMcp) {
    warnings.push("Plugin has no components (skills, commands, agents, hooks, or MCP)");
  }

  // Validate hooks JSON if present
  const hooksPath = join(rootPath, "hooks", "hooks.json");
  if (await pathExists(hooksPath)) {
    const jsonResult = await isValidJson(hooksPath);
    if (!jsonResult.valid) {
      errors.push(`Invalid hooks.json: ${jsonResult.error}`);
    }
  }

  // Validate MCP JSON if present
  if (hasMcp) {
    const jsonResult = await isValidJson(join(rootPath, ".mcp.json"));
    if (!jsonResult.valid) {
      errors.push(`Invalid .mcp.json: ${jsonResult.error}`);
    }
  }

  // Validate settings.json if present
  const settingsPath = join(rootPath, "settings.json");
  if (await pathExists(settingsPath)) {
    const jsonResult = await isValidJson(settingsPath);
    if (!jsonResult.valid) {
      errors.push(`Invalid settings.json: ${jsonResult.error}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── OpenCode Plugin Validation ───────────────────────────────────────

export async function validateOpenCodePlugin(
  rootPath: string,
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check config
  const configPath = join(rootPath, "opencode.json");
  if (await pathExists(configPath)) {
    const jsonResult = await isValidJson(configPath);
    if (!jsonResult.valid) {
      errors.push(`Invalid opencode.json: ${jsonResult.error}`);
    } else {
      const content = await readFile(configPath, "utf-8");
      const config = JSON.parse(content);
      if (!config.name) {
        errors.push('opencode.json missing required "name" field');
      }
    }
  } else {
    warnings.push("No opencode.json found; plugin may not be properly configured");
  }

  // Check for components
  const hasInstructions = await pathExists(join(rootPath, "instructions"));
  const hasCommands = await pathExists(join(rootPath, "commands"));
  const hasPlugins = await pathExists(join(rootPath, ".opencode", "plugins"));
  const hasAgents = await pathExists(join(rootPath, ".opencode", "agents"));

  if (!hasInstructions && !hasCommands && !hasPlugins && !hasAgents) {
    warnings.push("Plugin has no components (instructions, commands, plugins, or agents)");
  }

  // Validate TypeScript plugin files exist and have exports
  if (hasPlugins) {
    // Check that at least one .ts file exists
    const pluginsDir = join(rootPath, ".opencode", "plugins");
    try {
      const { readdir } = await import("fs/promises");
      const files = await readdir(pluginsDir);
      const tsFiles = files.filter((f) => f.endsWith(".ts") || f.endsWith(".js"));
      if (tsFiles.length === 0) {
        warnings.push(".opencode/plugins/ directory exists but has no TypeScript/JavaScript files");
      }
    } catch {
      // Directory read error
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ── Generic Validation ───────────────────────────────────────────────

export async function validatePlugin(
  rootPath: string,
  format: "claude-code" | "opencode",
): Promise<ValidationResult> {
  if (format === "claude-code") {
    return validateClaudeCodePlugin(rootPath);
  }
  return validateOpenCodePlugin(rootPath);
}

export async function detectPluginFormat(
  rootPath: string,
): Promise<"claude-code" | "opencode" | "unknown"> {
  const hasClaudeMarker = await pathExists(
    join(rootPath, ".claude-plugin", "plugin.json"),
  );
  const hasOpenCodeMarker = await pathExists(
    join(rootPath, "opencode.json"),
  );

  // Also check for skills (Claude) vs instructions (OpenCode)
  const hasSkills = await pathExists(join(rootPath, "skills"));
  const hasInstructions = await pathExists(join(rootPath, "instructions"));

  if (hasClaudeMarker || (hasSkills && !hasOpenCodeMarker)) {
    return "claude-code";
  }
  if (hasOpenCodeMarker || (hasInstructions && !hasClaudeMarker)) {
    return "opencode";
  }
  return "unknown";
}
