/**
 * Codegen conversion strategy — AST/template-based, no AI.
 *
 * This strategy uses the TypeScript compiler API and template-based
 * generators to produce converted plugin files. It follows the same
 * parse → convert → serialize pipeline as rule-based conversion but
 * produces higher-quality TypeScript output using proper AST manipulation
 * rather than string concatenation.
 *
 * Advantages:
 * - No API keys required (completely free)
 * - Deterministic output (same input always produces same output)
 * - Fast (no network calls)
 * - Produces syntactically correct TypeScript via AST
 */

import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

import { parseClaudeCodePlugin } from "../parsers/claude-code-parser";
import { parseOpenCodePlugin } from "../parsers/open-code-parser";
import {
  convertClaudeHooksToOpenCode,
  convertOpenCodeHooksToClaude,
} from "../converters/hook-converter";
import {
  convertClaudeMCPToOpenCode,
  convertOpenCodeMCPToClaude,
} from "../converters/mcp-converter";
import {
  convertClaudeSkillsToOpenCode,
  convertOpenCodeSkillsToClaude,
} from "../converters/skill-converter";
import {
  convertClaudeAgentsToOpenCode,
  convertOpenCodeAgentsToClaude,
} from "../converters/agent-converter";
import {
  convertClaudeCommandsToOpenCode,
  convertOpenCodeCommandsToClaude,
} from "../converters/command-converter";

import { generateHooksPluginAST, generateHooksJSON } from "./hooks-generator";
import { generateCommandAST, generateCommandMarkdown } from "./commands-generator";
import {
  generateOpenCodeConfig,
  generateClaudeManifest,
  generateMCPConfig,
  generateHooksConfig,
  generateSettingsJSON,
} from "./config-generator";

import type {
  ConversionDirection,
  ConversionWarning,
  ChangeRecord,
} from "../core/types/common";

// ── Types ────────────────────────────────────────────────────────────

export interface CodegenConversionOptions {
  direction: ConversionDirection;
  sourcePath: string;
  outputPath: string;
  /** Specific components to convert */
  components?: Array<"hooks" | "skills" | "agents" | "commands" | "mcp">;
}

export interface CodegenConversionResult {
  strategy: "codegen";
  conversions: CodegenComponentResult[];
  warnings: ConversionWarning[];
  changes: ChangeRecord[];
  filesGenerated: number;
}

interface CodegenComponentResult {
  component: string;
  success: boolean;
  files: string[];
}

// ── Main Codegen Converter ───────────────────────────────────────────

export class CodegenConverter {
  async convert(
    options: CodegenConversionOptions,
  ): Promise<CodegenConversionResult> {
    const components = options.components || [
      "hooks",
      "skills",
      "agents",
      "commands",
      "mcp",
    ];

    const conversions: CodegenComponentResult[] = [];
    const warnings: ConversionWarning[] = [];
    const changes: ChangeRecord[] = [];
    let filesGenerated = 0;

    if (options.direction === "claude-to-opencode") {
      const result = await this.claudeToOpenCode(
        options.sourcePath,
        options.outputPath,
        components,
      );
      conversions.push(...result.conversions);
      warnings.push(...result.warnings);
      changes.push(...result.changes);
      filesGenerated += result.filesGenerated;
    } else {
      const result = await this.openCodeToClaude(
        options.sourcePath,
        options.outputPath,
        components,
      );
      conversions.push(...result.conversions);
      warnings.push(...result.warnings);
      changes.push(...result.changes);
      filesGenerated += result.filesGenerated;
    }

    return {
      strategy: "codegen",
      conversions,
      warnings,
      changes,
      filesGenerated,
    };
  }

  // ── Claude Code → OpenCode ──────────────────────────────────────

  private async claudeToOpenCode(
    sourcePath: string,
    outputPath: string,
    components: string[],
  ): Promise<{
    conversions: CodegenComponentResult[];
    warnings: ConversionWarning[];
    changes: ChangeRecord[];
    filesGenerated: number;
  }> {
    const plugin = await parseClaudeCodePlugin(sourcePath);
    const conversions: CodegenComponentResult[] = [];
    const warnings: ConversionWarning[] = [];
    const changes: ChangeRecord[] = [];
    let filesGenerated = 0;

    // Create output directory structure
    await mkdir(join(outputPath, ".opencode", "plugins"), { recursive: true });
    await mkdir(join(outputPath, ".opencode", "agents"), { recursive: true });
    await mkdir(join(outputPath, "instructions"), { recursive: true });
    await mkdir(join(outputPath, "commands"), { recursive: true });

    // Hooks — generate TypeScript plugin using AST
    if (components.includes("hooks") && Object.keys(plugin.hooks).length > 0) {
      const { hooks, warnings: hookWarnings } = convertClaudeHooksToOpenCode(plugin.hooks);
      warnings.push(...hookWarnings);

      const hooksTS = generateHooksPluginAST(hooks);
      const hooksPath = join(outputPath, ".opencode", "plugins", "hooks.ts");
      await writeFile(hooksPath, hooksTS);
      filesGenerated++;

      conversions.push({
        component: "hooks",
        success: true,
        files: [".opencode/plugins/hooks.ts"],
      });
      changes.push({
        type: "added",
        component: "hooks",
        targetPath: hooksPath,
        description: `Generated TypeScript hooks plugin via AST codegen (${hooks.length} handlers)`,
      });
    }

    // Skills → Instructions
    if (components.includes("skills") && plugin.skills.length > 0) {
      const { instructions, warnings: skillWarnings } = convertClaudeSkillsToOpenCode(plugin.skills);
      warnings.push(...skillWarnings);

      const files: string[] = [];
      for (const instruction of instructions) {
        const instrDir = join(outputPath, "instructions", instruction.name);
        await mkdir(instrDir, { recursive: true });
        const instrPath = join(instrDir, "README.md");
        await writeFile(instrPath, instruction.content);
        files.push(`instructions/${instruction.name}/README.md`);
        filesGenerated++;
      }

      conversions.push({ component: "skills", success: true, files });
      changes.push({
        type: "added",
        component: "skills",
        targetPath: outputPath,
        description: `Converted ${instructions.length} skill(s) to instructions`,
      });
    }

    // Agents
    if (components.includes("agents") && plugin.agents.length > 0) {
      const { agents, warnings: agentWarnings } = convertClaudeAgentsToOpenCode(plugin.agents);
      warnings.push(...agentWarnings);

      const files: string[] = [];
      for (const [name, agent] of Object.entries(agents)) {
        const agentPath = join(outputPath, ".opencode", "agents", `${name}.md`);
        await writeFile(
          agentPath,
          typeof agent.instructions === "string"
            ? agent.instructions
            : JSON.stringify(agent, null, 2),
        );
        files.push(`.opencode/agents/${name}.md`);
        filesGenerated++;
      }

      conversions.push({ component: "agents", success: true, files });
      changes.push({
        type: "added",
        component: "agents",
        targetPath: outputPath,
        description: `Converted ${Object.keys(agents).length} agent(s)`,
      });
    }

    // Commands — generate TypeScript stubs using AST
    if (components.includes("commands") && plugin.commands.length > 0) {
      const { commands, warnings: cmdWarnings } = convertClaudeCommandsToOpenCode(plugin.commands);
      warnings.push(...cmdWarnings);

      const files: string[] = [];
      for (const cmd of commands) {
        const cmdTS = generateCommandAST(cmd);
        const cmdPath = join(outputPath, "commands", `${cmd.name}.ts`);
        await writeFile(cmdPath, cmdTS);
        files.push(`commands/${cmd.name}.ts`);
        filesGenerated++;
      }

      conversions.push({ component: "commands", success: true, files });
      changes.push({
        type: "added",
        component: "commands",
        targetPath: outputPath,
        description: `Generated ${commands.length} TypeScript command stub(s) via AST codegen`,
      });
    }

    // MCP
    if (components.includes("mcp") && Object.keys(plugin.mcpServers).length > 0) {
      const { servers, warnings: mcpWarnings } = convertClaudeMCPToOpenCode(plugin.mcpServers);
      warnings.push(...mcpWarnings);
      // MCP goes into opencode.json (handled in config below)
    }

    // Generate opencode.json config
    const { hooks: convertedHooks } = components.includes("hooks")
      ? convertClaudeHooksToOpenCode(plugin.hooks)
      : { hooks: [] };
    const { commands: convertedCmds } = components.includes("commands")
      ? convertClaudeCommandsToOpenCode(plugin.commands)
      : { commands: [] };
    const { agents: convertedAgents } = components.includes("agents")
      ? convertClaudeAgentsToOpenCode(plugin.agents)
      : { agents: {} };
    const { servers: convertedMCP } = components.includes("mcp")
      ? convertClaudeMCPToOpenCode(plugin.mcpServers)
      : { servers: {} };

    const openCodePlugin = {
      config: {
        name: plugin.manifest.name,
        version: plugin.manifest.version,
        description: plugin.manifest.description,
        hooks: convertedHooks,
        mcpServers: convertedMCP,
        commands: convertedCmds,
        agents: convertedAgents,
        environment: plugin.settings?.env,
      },
      instructions: [],
      commands: convertedCmds,
      hooks: convertedHooks,
      mcpServers: convertedMCP,
      agents: convertedAgents,
      rootPath: outputPath,
    };

    const configJSON = generateOpenCodeConfig(openCodePlugin);
    await writeFile(join(outputPath, "opencode.json"), configJSON);
    filesGenerated++;

    return { conversions, warnings, changes, filesGenerated };
  }

  // ── OpenCode → Claude Code ──────────────────────────────────────

  private async openCodeToClaude(
    sourcePath: string,
    outputPath: string,
    components: string[],
  ): Promise<{
    conversions: CodegenComponentResult[];
    warnings: ConversionWarning[];
    changes: ChangeRecord[];
    filesGenerated: number;
  }> {
    const plugin = await parseOpenCodePlugin(sourcePath);
    const conversions: CodegenComponentResult[] = [];
    const warnings: ConversionWarning[] = [];
    const changes: ChangeRecord[] = [];
    let filesGenerated = 0;

    // Create output directory structure
    await mkdir(join(outputPath, ".claude-plugin"), { recursive: true });
    await mkdir(join(outputPath, "skills"), { recursive: true });
    await mkdir(join(outputPath, "commands"), { recursive: true });
    await mkdir(join(outputPath, "agents"), { recursive: true });
    await mkdir(join(outputPath, "hooks"), { recursive: true });

    // Hooks → hooks.json
    if (components.includes("hooks") && plugin.hooks.length > 0) {
      const { hooks, warnings: hookWarnings } = convertOpenCodeHooksToClaude(plugin.hooks);
      warnings.push(...hookWarnings);

      const hooksJSON = generateHooksConfig(hooks);
      const hooksPath = join(outputPath, "hooks", "hooks.json");
      await writeFile(hooksPath, hooksJSON);
      filesGenerated++;

      conversions.push({
        component: "hooks",
        success: true,
        files: ["hooks/hooks.json"],
      });
      changes.push({
        type: "added",
        component: "hooks",
        targetPath: hooksPath,
        description: `Generated hooks.json via codegen (${plugin.hooks.length} hooks)`,
      });
    }

    // Instructions → Skills
    if (components.includes("skills") && plugin.instructions.length > 0) {
      const { skills, warnings: skillWarnings } = convertOpenCodeSkillsToClaude(plugin.instructions);
      warnings.push(...skillWarnings);

      const files: string[] = [];
      for (const skill of skills) {
        const skillDir = join(outputPath, "skills", skill.name);
        await mkdir(skillDir, { recursive: true });
        const skillPath = join(skillDir, "SKILL.md");
        await writeFile(skillPath, skill.content);
        files.push(`skills/${skill.name}/SKILL.md`);
        filesGenerated++;
      }

      conversions.push({ component: "skills", success: true, files });
      changes.push({
        type: "added",
        component: "skills",
        targetPath: outputPath,
        description: `Converted ${skills.length} instruction(s) to skills`,
      });
    }

    // Agents
    if (components.includes("agents") && Object.keys(plugin.agents).length > 0) {
      const { agents, warnings: agentWarnings } = convertOpenCodeAgentsToClaude(plugin.agents);
      warnings.push(...agentWarnings);

      const files: string[] = [];
      for (const agent of agents) {
        const agentPath = join(outputPath, "agents", `${agent.name}.md`);
        await writeFile(agentPath, agent.content);
        files.push(`agents/${agent.name}.md`);
        filesGenerated++;
      }

      conversions.push({ component: "agents", success: true, files });
      changes.push({
        type: "added",
        component: "agents",
        targetPath: outputPath,
        description: `Converted ${agents.length} agent(s)`,
      });
    }

    // Commands → Markdown
    if (components.includes("commands") && plugin.commands.length > 0) {
      const { commands, warnings: cmdWarnings } = convertOpenCodeCommandsToClaude(plugin.commands);
      warnings.push(...cmdWarnings);

      const files: string[] = [];
      for (const cmd of commands) {
        const cmdMD = generateCommandMarkdown(cmd);
        const cmdPath = join(outputPath, "commands", `${cmd.name}.md`);
        await writeFile(cmdPath, cmdMD);
        files.push(`commands/${cmd.name}.md`);
        filesGenerated++;
      }

      conversions.push({ component: "commands", success: true, files });
      changes.push({
        type: "added",
        component: "commands",
        targetPath: outputPath,
        description: `Generated ${commands.length} markdown command(s)`,
      });
    }

    // MCP
    if (components.includes("mcp") && Object.keys(plugin.mcpServers).length > 0) {
      const { servers, warnings: mcpWarnings } = convertOpenCodeMCPToClaude(plugin.mcpServers);
      warnings.push(...mcpWarnings);

      const mcpJSON = generateMCPConfig(servers);
      await writeFile(join(outputPath, ".mcp.json"), mcpJSON);
      filesGenerated++;

      conversions.push({
        component: "mcp",
        success: true,
        files: [".mcp.json"],
      });
    }

    // Generate plugin.json manifest
    const claudePlugin = {
      manifest: {
        name: plugin.config.name,
        version: plugin.config.version,
        description: plugin.config.description,
      },
      skills: [],
      commands: [],
      agents: [],
      hooks: {},
      mcpServers: {},
      rootPath: outputPath,
    };

    const manifestJSON = generateClaudeManifest(claudePlugin);
    await writeFile(join(outputPath, ".claude-plugin", "plugin.json"), manifestJSON);
    filesGenerated++;

    // Generate settings.json if needed
    if (plugin.config.environment) {
      const settingsJSON = generateSettingsJSON({ env: plugin.config.environment });
      if (settingsJSON) {
        await writeFile(join(outputPath, "settings.json"), settingsJSON);
        filesGenerated++;
      }
    }

    return { conversions, warnings, changes, filesGenerated };
  }
}
