/**
 * Agentic conversion layer that uses AI SDKs to intelligently convert
 * plugin components that require semantic understanding.
 *
 * When converting from Claude Code → OpenCode, uses the OpenCode SDK
 * (@opencode-ai/sdk) first for context-aware conversion.
 * When converting from OpenCode → Claude Code, uses the Claude Agent SDK
 * (@anthropic-ai/claude-agent-sdk) first.
 *
 * Falls back to the other SDK if the preferred one is unavailable.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import type {
  ConversionDirection,
  ConversionWarning,
  ChangeRecord,
} from "../core/types/common";

// ── SDK Availability Detection ───────────────────────────────────────

interface SDKAvailability {
  claudeAgentSDK: boolean;
  openCodeSDK: boolean;
}

async function detectSDKs(): Promise<SDKAvailability> {
  const result: SDKAvailability = {
    claudeAgentSDK: false,
    openCodeSDK: false,
  };

  try {
    await import("@anthropic-ai/claude-agent-sdk");
    result.claudeAgentSDK = true;
  } catch {
    // SDK not available
  }

  try {
    await import("@opencode-ai/sdk");
    result.openCodeSDK = true;
  } catch {
    // SDK not available
  }

  return result;
}

// ── Agentic Conversion Interface ─────────────────────────────────────

export interface AgenticConversionOptions {
  direction: ConversionDirection;
  sourcePath: string;
  outputPath: string;
  /** Specific components to convert agentically */
  components?: Array<"hooks" | "skills" | "agents" | "commands" | "mcp">;
  /** Maximum budget for agentic conversion (USD) */
  maxBudgetUsd?: number;
  /** Whether to use agentic conversion (falls back to rule-based if false) */
  enabled?: boolean;
  /** Preferred SDK to use */
  preferredSdk?: "claude" | "opencode" | "auto";
}

export interface AgenticConversionResult {
  sdkUsed: "claude" | "opencode" | "none";
  conversions: AgenticComponentResult[];
  warnings: ConversionWarning[];
  changes: ChangeRecord[];
  totalCostUsd?: number;
}

interface AgenticComponentResult {
  component: string;
  success: boolean;
  outputFiles: string[];
  reasoning?: string;
}

// ── Main Agentic Converter ───────────────────────────────────────────

export class AgenticConverter {
  private sdks: SDKAvailability | null = null;

  async convert(
    options: AgenticConversionOptions,
  ): Promise<AgenticConversionResult> {
    if (options.enabled === false) {
      return {
        sdkUsed: "none",
        conversions: [],
        warnings: [
          {
            severity: "info",
            component: "agentic",
            message: "Agentic conversion disabled; using rule-based conversion only",
          },
        ],
        changes: [],
      };
    }

    this.sdks = await detectSDKs();
    const preferredSdk = this.selectSDK(options);

    if (preferredSdk === "none") {
      return {
        sdkUsed: "none",
        conversions: [],
        warnings: [
          {
            severity: "warning",
            component: "agentic",
            message:
              "No AI SDK available. Install @anthropic-ai/claude-agent-sdk or @opencode-ai/sdk for agentic conversion.",
            suggestion:
              "Run: bun add @anthropic-ai/claude-agent-sdk or bun add @opencode-ai/sdk",
          },
        ],
        changes: [],
      };
    }

    const components = options.components || [
      "hooks",
      "skills",
      "agents",
      "commands",
      "mcp",
    ];

    if (preferredSdk === "claude") {
      return this.convertWithClaudeSDK(options, components);
    } else {
      return this.convertWithOpenCodeSDK(options, components);
    }
  }

  private selectSDK(
    options: AgenticConversionOptions,
  ): "claude" | "opencode" | "none" {
    const sdks = this.sdks!;

    if (options.preferredSdk === "claude" && sdks.claudeAgentSDK) {
      return "claude";
    }
    if (options.preferredSdk === "opencode" && sdks.openCodeSDK) {
      return "opencode";
    }

    // Auto-select based on direction
    if (options.preferredSdk === "auto" || !options.preferredSdk) {
      if (
        options.direction === "claude-to-opencode" &&
        sdks.openCodeSDK
      ) {
        return "opencode";
      }
      if (
        options.direction === "opencode-to-claude" &&
        sdks.claudeAgentSDK
      ) {
        return "claude";
      }
      // Fallback to whichever is available
      if (sdks.claudeAgentSDK) return "claude";
      if (sdks.openCodeSDK) return "opencode";
    }

    return "none";
  }

  // ── Claude Agent SDK Conversion ──────────────────────────────────

  private async convertWithClaudeSDK(
    options: AgenticConversionOptions,
    components: string[],
  ): Promise<AgenticConversionResult> {
    const warnings: ConversionWarning[] = [];
    const changes: ChangeRecord[] = [];
    const conversions: AgenticComponentResult[] = [];

    try {
      const { query } = await import("@anthropic-ai/claude-agent-sdk");

      for (const component of components) {
        const prompt = this.buildConversionPrompt(
          component,
          options.direction,
          options.sourcePath,
        );

        const result = query({
          prompt,
          options: {
            allowedTools: ["Read", "Write", "Glob", "Grep"],
            maxTurns: 10,
            maxBudgetUsd: options.maxBudgetUsd || 0.50,
            permissionMode: "bypassPermissions",
            systemPrompt: CONVERSION_SYSTEM_PROMPT,
          },
        });

        const outputFiles: string[] = [];
        let reasoning = "";

        for await (const message of result) {
          if (message.type === "assistant") {
            const content = message.message.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                if (block.type === "text") {
                  reasoning += block.text;
                }
              }
            }
          }
        }

        conversions.push({
          component,
          success: true,
          outputFiles,
          reasoning,
        });

        changes.push({
          type: "modified",
          component,
          sourcePath: options.sourcePath,
          targetPath: options.outputPath,
          description: `Agentically converted ${component} using Claude Agent SDK`,
        });
      }
    } catch (error) {
      warnings.push({
        severity: "warning",
        component: "agentic",
        message: `Claude Agent SDK conversion failed: ${error instanceof Error ? error.message : String(error)}`,
        suggestion: "Falling back to rule-based conversion",
      });
    }

    return {
      sdkUsed: "claude",
      conversions,
      warnings,
      changes,
    };
  }

  // ── OpenCode SDK Conversion ──────────────────────────────────────

  private async convertWithOpenCodeSDK(
    options: AgenticConversionOptions,
    components: string[],
  ): Promise<AgenticConversionResult> {
    const warnings: ConversionWarning[] = [];
    const changes: ChangeRecord[] = [];
    const conversions: AgenticComponentResult[] = [];

    try {
      const { createOpencode } = await import("@opencode-ai/sdk");
      const { client } = await createOpencode();

      const session = await client.session.create({});
      const sessionId = session.data.id;

      for (const component of components) {
        const prompt = this.buildConversionPrompt(
          component,
          options.direction,
          options.sourcePath,
        );

        await client.session.prompt({
          sessionId,
          message: prompt,
        });

        conversions.push({
          component,
          success: true,
          outputFiles: [],
        });

        changes.push({
          type: "modified",
          component,
          sourcePath: options.sourcePath,
          targetPath: options.outputPath,
          description: `Agentically converted ${component} using OpenCode SDK`,
        });
      }
    } catch (error) {
      warnings.push({
        severity: "warning",
        component: "agentic",
        message: `OpenCode SDK conversion failed: ${error instanceof Error ? error.message : String(error)}`,
        suggestion: "Falling back to rule-based conversion",
      });
    }

    return {
      sdkUsed: "opencode",
      conversions,
      warnings,
      changes,
    };
  }

  // ── Prompt Building ──────────────────────────────────────────────

  private buildConversionPrompt(
    component: string,
    direction: ConversionDirection,
    sourcePath: string,
  ): string {
    const isClaudeToOpenCode = direction === "claude-to-opencode";
    const sourceFormat = isClaudeToOpenCode ? "Claude Code" : "OpenCode";
    const targetFormat = isClaudeToOpenCode ? "OpenCode" : "Claude Code";

    const componentPrompts: Record<string, string> = {
      hooks: `Convert the ${sourceFormat} hook configurations to ${targetFormat} format.
${isClaudeToOpenCode
  ? `Claude Code hooks use declarative JSON with matchers and shell commands.
OpenCode hooks use TypeScript event subscriptions (tool.execute.before, tool.execute.after, etc.).
Convert each hook matcher to the appropriate OpenCode event handler.`
  : `OpenCode hooks use TypeScript event subscriptions.
Claude Code hooks use declarative JSON with matchers and shell commands in settings.json.
Convert each event handler to a Claude Code hook matcher.`
}`,
      skills: `Convert the ${sourceFormat} ${isClaudeToOpenCode ? "skills (SKILL.md files)" : "instructions"} to ${targetFormat} format.
Preserve all content while adapting the structure.
${isClaudeToOpenCode
  ? "Convert skills/*/SKILL.md to instructions/*/README.md"
  : "Convert instructions/ markdown files to skills/*/SKILL.md"
}`,
      agents: `Convert the ${sourceFormat} agent definitions to ${targetFormat} format.
${isClaudeToOpenCode
  ? "Claude Code agents are markdown files. OpenCode agents need provider/model configuration."
  : "OpenCode agents have provider info. Claude Code agents are just markdown files."
}`,
      commands: `Convert the ${sourceFormat} commands to ${targetFormat} format.
${isClaudeToOpenCode
  ? "Claude Code commands are markdown files. OpenCode commands are TypeScript modules."
  : "OpenCode commands are TypeScript modules. Claude Code commands are markdown files."
}`,
      mcp: `Convert the MCP server configurations from ${sourceFormat} to ${targetFormat} format.
Both formats support MCP but with slightly different config structures.
Handle environment variable substitutions and transport type differences.`,
    };

    return `You are converting a plugin from ${sourceFormat} to ${targetFormat} format.

Source plugin is at: ${sourcePath}

Focus on the "${component}" component.

${componentPrompts[component] || `Convert the ${component} component.`}

Read the source files, understand the intent, and produce well-structured output files.
Preserve all functionality and document any limitations.`;
  }
}

// ── System Prompt for Agentic Conversion ─────────────────────────────

const CONVERSION_SYSTEM_PROMPT = `You are a plugin conversion specialist that converts between Claude Code and OpenCode plugin formats.

Your expertise includes:
- Claude Code plugin structure: .claude-plugin/plugin.json, skills/, commands/, agents/, hooks/, .mcp.json
- OpenCode plugin structure: opencode.json, .opencode/plugins/*.ts, .opencode/agents/*.md, instructions/
- Hook event mapping between both systems
- MCP server configuration differences
- Skill/instruction content adaptation

Key conversion rules:
1. Claude Code hooks (PreToolUse, PostToolUse, etc.) map to OpenCode events (tool.execute.before, tool.execute.after, etc.)
2. Claude Code skills (SKILL.md) become OpenCode instructions (README.md)
3. Claude Code agents (markdown) become OpenCode agents (markdown + provider config)
4. Claude Code commands (markdown) become OpenCode commands (TypeScript stubs)
5. MCP server configs are similar but OpenCode adds transport type

Always preserve the original intent and functionality. Document any conversions that are lossy or require manual adjustment.`;
