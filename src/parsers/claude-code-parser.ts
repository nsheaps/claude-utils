/**
 * Parser for Claude Code plugin format.
 *
 * Reads a Claude Code plugin directory and produces a structured
 * ClaudeCodePlugin object. Also serializes back to disk.
 */

import { readdir, readFile, stat, mkdir, writeFile } from "fs/promises";
import { join, basename, relative } from "path";
import type {
  ClaudeCodePlugin,
  ClaudeCodePluginManifest,
  ClaudeCodeSkill,
  ClaudeCodeCommand,
  ClaudeCodeAgent,
  ClaudeCodeHooks,
  ClaudeCodeMCPServers,
  ClaudeCodeSettings,
} from "../core/types";

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function readJsonFile<T>(path: string): Promise<T | null> {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
}

async function readMarkdownFiles(
  dir: string,
): Promise<Array<{ name: string; path: string; content: string }>> {
  const results: Array<{ name: string; path: string; content: string }> = [];
  if (!(await exists(dir))) return results;

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const content = await readFile(fullPath, "utf-8");
      results.push({
        name: entry.name.replace(/\.md$/, ""),
        path: relative(dir, fullPath),
        content,
      });
    } else if (entry.isDirectory()) {
      // Check for SKILL.md pattern inside subdirectory
      const skillMd = join(fullPath, "SKILL.md");
      if (await exists(skillMd)) {
        const content = await readFile(skillMd, "utf-8");
        const references: string[] = [];
        const refsDir = join(fullPath, "references");
        if (await exists(refsDir)) {
          const refEntries = await readdir(refsDir);
          references.push(
            ...refEntries.map((r) => join("references", r)),
          );
        }
        results.push({
          name: entry.name,
          path: relative(dir, skillMd),
          content,
        });
      }
    }
  }
  return results;
}

// ── Parse ────────────────────────────────────────────────────────────

export async function parseClaudeCodePlugin(
  rootPath: string,
): Promise<ClaudeCodePlugin> {
  // Read manifest
  const manifestPath = join(rootPath, ".claude-plugin", "plugin.json");
  let manifest: ClaudeCodePluginManifest = { name: basename(rootPath) };
  const parsedManifest =
    await readJsonFile<ClaudeCodePluginManifest>(manifestPath);
  if (parsedManifest) {
    manifest = parsedManifest;
  }

  // Parse skills
  const skillsDir = join(rootPath, "skills");
  const rawSkills = await readMarkdownFiles(skillsDir);
  const skills: ClaudeCodeSkill[] = rawSkills.map((s) => ({
    name: s.name,
    path: s.path,
    content: s.content,
    references: [],
  }));

  // Parse commands
  const commandsDir = join(rootPath, "commands");
  const rawCommands = await readMarkdownFiles(commandsDir);
  const commands: ClaudeCodeCommand[] = rawCommands.map((c) => {
    const parsed = parseCommandFrontmatter(c.content);
    return {
      name: parsed.name || c.name,
      aliases: parsed.aliases,
      description: parsed.description || "",
      examples: parsed.examples,
      parameters: parsed.parameters,
      content: parsed.body,
      path: c.path,
    };
  });

  // Parse agents
  const agentsDir = join(rootPath, "agents");
  const rawAgents = await readMarkdownFiles(agentsDir);
  const agents: ClaudeCodeAgent[] = rawAgents.map((a) => ({
    name: a.name,
    path: a.path,
    content: a.content,
  }));

  // Parse hooks
  let hooks: ClaudeCodeHooks = {};
  const hooksJsonPath = join(rootPath, "hooks", "hooks.json");
  const hooksData = await readJsonFile<{ hooks: ClaudeCodeHooks }>(hooksJsonPath);
  if (hooksData?.hooks) {
    hooks = hooksData.hooks;
  }
  // Also check settings.json for hooks
  const settingsPath = join(rootPath, "settings.json");
  const settings = await readJsonFile<ClaudeCodeSettings>(settingsPath);
  if (settings?.hooks) {
    hooks = { ...hooks, ...settings.hooks };
  }

  // Parse MCP servers
  let mcpServers: ClaudeCodeMCPServers = {};
  const mcpJsonPath = join(rootPath, ".mcp.json");
  const mcpData =
    await readJsonFile<{ mcpServers: ClaudeCodeMCPServers }>(mcpJsonPath);
  if (mcpData?.mcpServers) {
    mcpServers = mcpData.mcpServers;
  }

  return {
    manifest,
    skills,
    commands,
    agents,
    hooks,
    mcpServers,
    settings: settings || undefined,
    rootPath,
  };
}

// ── Serialize ────────────────────────────────────────────────────────

export async function serializeClaudeCodePlugin(
  plugin: ClaudeCodePlugin,
  outputPath: string,
): Promise<void> {
  // Create directory structure
  await mkdir(join(outputPath, ".claude-plugin"), { recursive: true });
  await mkdir(join(outputPath, "skills"), { recursive: true });
  await mkdir(join(outputPath, "commands"), { recursive: true });
  await mkdir(join(outputPath, "agents"), { recursive: true });
  await mkdir(join(outputPath, "hooks"), { recursive: true });

  // Write manifest
  await writeFile(
    join(outputPath, ".claude-plugin", "plugin.json"),
    JSON.stringify(plugin.manifest, null, 2) + "\n",
  );

  // Write skills
  for (const skill of plugin.skills) {
    const skillDir = join(outputPath, "skills", skill.name);
    await mkdir(skillDir, { recursive: true });
    await writeFile(join(skillDir, "SKILL.md"), skill.content);
  }

  // Write commands
  for (const cmd of plugin.commands) {
    await writeFile(
      join(outputPath, "commands", `${cmd.name}.md`),
      serializeCommandToMarkdown(cmd),
    );
  }

  // Write agents
  for (const agent of plugin.agents) {
    await writeFile(
      join(outputPath, "agents", `${agent.name}.md`),
      agent.content,
    );
  }

  // Write hooks
  if (Object.keys(plugin.hooks).length > 0) {
    await writeFile(
      join(outputPath, "hooks", "hooks.json"),
      JSON.stringify({ hooks: plugin.hooks }, null, 2) + "\n",
    );
  }

  // Write MCP config
  if (Object.keys(plugin.mcpServers).length > 0) {
    await writeFile(
      join(outputPath, ".mcp.json"),
      JSON.stringify({ mcpServers: plugin.mcpServers }, null, 2) + "\n",
    );
  }

  // Write settings if present
  if (plugin.settings) {
    const { hooks: _hooks, ...settingsWithoutHooks } = plugin.settings;
    if (Object.keys(settingsWithoutHooks).length > 0) {
      await writeFile(
        join(outputPath, "settings.json"),
        JSON.stringify(settingsWithoutHooks, null, 2) + "\n",
      );
    }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

interface ParsedFrontmatter {
  name?: string;
  aliases?: string[];
  description?: string;
  examples?: string[];
  parameters?: Array<{
    name: string;
    type: string;
    description: string;
    required?: boolean;
  }>;
  body: string;
}

function parseCommandFrontmatter(content: string): ParsedFrontmatter {
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    return { body: content };
  }

  const [, frontmatter, body] = frontmatterMatch;
  const result: ParsedFrontmatter = { body };

  // Simple YAML-like parsing for known fields
  for (const line of frontmatter.split("\n")) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (!match) continue;
    const [, key, value] = match;
    switch (key) {
      case "name":
        result.name = value.trim();
        break;
      case "description":
        result.description = value.trim();
        break;
    }
  }

  return result;
}

function serializeCommandToMarkdown(cmd: ClaudeCodeCommand): string {
  const parts: string[] = [];

  // Frontmatter
  parts.push("---");
  parts.push(`name: ${cmd.name}`);
  if (cmd.aliases?.length) {
    parts.push(`aliases: [${cmd.aliases.join(", ")}]`);
  }
  if (cmd.description) {
    parts.push(`description: ${cmd.description}`);
  }
  parts.push("---");
  parts.push("");

  // Body
  parts.push(cmd.content);

  return parts.join("\n");
}
