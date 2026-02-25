/**
 * Parser for Open Code (sst/opencode) plugin format.
 *
 * Reads an OpenCode plugin directory and produces a structured
 * OpenCodePlugin object. Also serializes back to disk.
 *
 * OpenCode plugins are code-based TypeScript modules, so this parser
 * handles both the declarative config (opencode.json) and the code-based
 * plugin files (.opencode/plugins/*.ts).
 */

import { readdir, readFile, stat, mkdir, writeFile } from "fs/promises";
import { join, basename, relative } from "path";
import type {
  OpenCodePlugin,
  OpenCodeConfig,
  OpenCodeInstruction,
  OpenCodeCommand,
  OpenCodeHookConfig,
  OpenCodeMCPServers,
  OpenCodeAgent,
  OpenCodeHookEvent,
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

// ── Parse ────────────────────────────────────────────────────────────

export async function parseOpenCodePlugin(
  rootPath: string,
): Promise<OpenCodePlugin> {
  // Read main config
  let config: OpenCodeConfig = { name: basename(rootPath) };

  // Try opencode.json first, then opencode.yaml
  const configPath = join(rootPath, "opencode.json");
  const parsed = await readJsonFile<OpenCodeConfig>(configPath);
  if (parsed) {
    config = parsed;
  }

  // Parse instructions (equivalent to Claude Code skills)
  const instructions = await parseInstructions(rootPath);

  // Parse commands
  const commands = await parseCommands(rootPath);

  // Parse hooks from config and plugin files
  const hooks = await parseHooks(rootPath, config);

  // Parse MCP servers
  const mcpServers = config.mcpServers || {};

  // Parse agents
  const agents = await parseAgents(rootPath, config);

  return {
    config,
    instructions,
    commands,
    hooks,
    mcpServers,
    agents,
    rootPath,
  };
}

async function parseInstructions(
  rootPath: string,
): Promise<OpenCodeInstruction[]> {
  const instructions: OpenCodeInstruction[] = [];
  const instructionsDir = join(rootPath, "instructions");
  if (!(await exists(instructionsDir))) return instructions;

  const entries = await readdir(instructionsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(".md")) {
      const fullPath = join(instructionsDir, entry.name);
      const content = await readFile(fullPath, "utf-8");
      instructions.push({
        name: entry.name.replace(/\.md$/, ""),
        path: relative(rootPath, fullPath),
        content,
      });
    } else if (entry.isDirectory()) {
      const indexPath = join(instructionsDir, entry.name, "README.md");
      if (await exists(indexPath)) {
        const content = await readFile(indexPath, "utf-8");
        instructions.push({
          name: entry.name,
          path: relative(rootPath, indexPath),
          content,
        });
      }
    }
  }
  return instructions;
}

async function parseCommands(rootPath: string): Promise<OpenCodeCommand[]> {
  const commands: OpenCodeCommand[] = [];
  const commandsDir = join(rootPath, "commands");
  if (!(await exists(commandsDir))) return commands;

  const entries = await readdir(commandsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".js"))) {
      const fullPath = join(commandsDir, entry.name);
      const content = await readFile(fullPath, "utf-8");

      // Extract metadata from TypeScript source
      const name = entry.name.replace(/\.(ts|js)$/, "");
      const descMatch = content.match(/description:\s*["'](.+?)["']/);

      commands.push({
        name,
        description: descMatch?.[1] || "",
        handler: relative(rootPath, fullPath),
      });
    }
  }
  return commands;
}

async function parseHooks(
  rootPath: string,
  config: OpenCodeConfig,
): Promise<OpenCodeHookConfig[]> {
  const hooks: OpenCodeHookConfig[] = [];

  // Hooks from config
  if (config.hooks) {
    hooks.push(...config.hooks);
  }

  // Hooks from plugin files
  const pluginsDir = join(rootPath, ".opencode", "plugins");
  if (await exists(pluginsDir)) {
    const entries = await readdir(pluginsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && (entry.name.endsWith(".ts") || entry.name.endsWith(".js"))) {
        const fullPath = join(pluginsDir, entry.name);
        const content = await readFile(fullPath, "utf-8");
        const extractedHooks = extractHooksFromSource(content);
        hooks.push(...extractedHooks);
      }
    }
  }

  return hooks;
}

function extractHooksFromSource(content: string): OpenCodeHookConfig[] {
  const hooks: OpenCodeHookConfig[] = [];

  // Match event subscriptions in TypeScript plugin source
  const eventPatterns: Array<[RegExp, OpenCodeHookEvent]> = [
    [/tool\.execute\.before/g, "beforeTool"],
    [/tool\.execute\.after/g, "afterTool"],
    [/session\.created/g, "sessionStart"],
    [/session\.idle/g, "idle"],
    [/session\.error/g, "afterToolError"],
    [/permission\.asked/g, "permissionCheck"],
  ];

  for (const [pattern, event] of eventPatterns) {
    if (pattern.test(content)) {
      hooks.push({
        event,
        handler: "(inline plugin handler)",
      });
    }
  }

  return hooks;
}

async function parseAgents(
  rootPath: string,
  config: OpenCodeConfig,
): Promise<Record<string, OpenCodeAgent>> {
  const agents: Record<string, OpenCodeAgent> = {};

  // From config
  if (config.agents) {
    Object.assign(agents, config.agents);
  }

  // From agent markdown files
  const agentsDir = join(rootPath, ".opencode", "agents");
  if (await exists(agentsDir)) {
    const entries = await readdir(agentsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(".md")) {
        const fullPath = join(agentsDir, entry.name);
        const content = await readFile(fullPath, "utf-8");
        const name = entry.name.replace(/\.md$/, "");
        agents[name] = {
          name,
          provider: "default",
          model: "default",
          instructions: content,
        };
      }
    }
  }

  return agents;
}

// ── Serialize ────────────────────────────────────────────────────────

export async function serializeOpenCodePlugin(
  plugin: OpenCodePlugin,
  outputPath: string,
): Promise<void> {
  // Create directory structure
  await mkdir(join(outputPath, ".opencode", "plugins"), { recursive: true });
  await mkdir(join(outputPath, ".opencode", "agents"), { recursive: true });
  await mkdir(join(outputPath, "instructions"), { recursive: true });
  await mkdir(join(outputPath, "commands"), { recursive: true });

  // Write config
  await writeFile(
    join(outputPath, "opencode.json"),
    JSON.stringify(plugin.config, null, 2) + "\n",
  );

  // Write instructions (skills equivalent)
  for (const instruction of plugin.instructions) {
    const instrDir = join(outputPath, "instructions", instruction.name);
    await mkdir(instrDir, { recursive: true });
    await writeFile(join(instrDir, "README.md"), instruction.content);
  }

  // Write commands as TypeScript stubs
  for (const cmd of plugin.commands) {
    await writeFile(
      join(outputPath, "commands", `${cmd.name}.ts`),
      generateCommandStub(cmd),
    );
  }

  // Write agents
  for (const [name, agent] of Object.entries(plugin.agents)) {
    await writeFile(
      join(outputPath, ".opencode", "agents", `${name}.md`),
      typeof agent.instructions === "string"
        ? agent.instructions
        : JSON.stringify(agent, null, 2),
    );
  }

  // Write plugin file with hooks
  if (plugin.hooks.length > 0) {
    await writeFile(
      join(outputPath, ".opencode", "plugins", "hooks.ts"),
      generateHooksPlugin(plugin.hooks),
    );
  }

  // Write MCP config into opencode.json (already included in config)
  if (Object.keys(plugin.mcpServers).length > 0) {
    const configPath = join(outputPath, "opencode.json");
    const existingConfig = await readJsonFile<OpenCodeConfig>(configPath);
    if (existingConfig) {
      existingConfig.mcpServers = plugin.mcpServers;
      await writeFile(configPath, JSON.stringify(existingConfig, null, 2) + "\n");
    }
  }
}

function generateCommandStub(cmd: OpenCodeCommand): string {
  return `/**
 * ${cmd.description || cmd.name}
 *
 * Auto-generated from Claude Code plugin conversion.
 * Adapt this stub to implement the command logic.
 */

export default {
  name: ${JSON.stringify(cmd.name)},
  ${cmd.aliases ? `aliases: ${JSON.stringify(cmd.aliases)},` : ""}
  description: ${JSON.stringify(cmd.description)},
  ${cmd.parameters ? `parameters: ${JSON.stringify(cmd.parameters, null, 2)},` : ""}
  async handler(args: Record<string, unknown>) {
    // TODO: Implement command logic
    console.log("Command ${cmd.name} called with:", args);
  },
};
`;
}

function generateHooksPlugin(hooks: OpenCodeHookConfig[]): string {
  const eventHandlers: string[] = [];

  // Map OpenCode events to SSE event subscription calls
  const eventMap: Record<string, string> = {
    beforeTool: "tool.execute.before",
    afterTool: "tool.execute.after",
    afterToolError: "session.error",
    sessionStart: "session.created",
    sessionEnd: "session.deleted",
    idle: "session.idle",
    permissionCheck: "permission.asked",
    notification: "tui.toast.show",
    beforePrompt: "tui.prompt.append",
  };

  for (const hook of hooks) {
    const sseEvent = eventMap[hook.event] || hook.event;
    if (hook.command) {
      eventHandlers.push(`    // ${hook.event}: ${hook.command}
    client.event.subscribe("${sseEvent}", async (event) => {
      const { execSync } = await import("child_process");
      execSync(${JSON.stringify(hook.command)}, {
        env: { ...process.env, OPENCODE_EVENT: JSON.stringify(event) },
        stdio: "pipe",
      });
    });`);
    } else if (hook.handler && hook.handler !== "(inline plugin handler)") {
      eventHandlers.push(`    // ${hook.event}: ${hook.handler}
    client.event.subscribe("${sseEvent}", async (event) => {
      const handler = await import(${JSON.stringify(hook.handler)});
      await handler.default(event);
    });`);
    }
  }

  return `/**
 * Hooks plugin - auto-generated from Claude Code plugin conversion.
 *
 * This plugin registers event handlers that correspond to Claude Code hooks.
 * Review and adapt each handler for OpenCode's event system.
 */
import type { PluginContext } from "@opencode-ai/plugin";

export const HooksPlugin = async ({ client }: PluginContext) => {
${eventHandlers.length > 0 ? eventHandlers.join("\n\n") : "    // No hooks to register"}

  return {};
};

export default HooksPlugin;
`;
}
