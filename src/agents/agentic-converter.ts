/**
 * AI-powered conversion layer with three strategies:
 *
 * 1. **Agentic (Claude Agent SDK)** — Runs a multi-turn agent that reads source
 *    files, reasons about the conversion, and writes output. Best when converting
 *    OpenCode → Claude Code (uses the target platform's SDK for context).
 *
 * 2. **Agentic (OpenCode SDK)** — Same multi-turn approach via OpenCode's SDK.
 *    Best when converting Claude Code → OpenCode.
 *
 * 3. **Codegen (Anthropic Messages API)** — Single-shot code generation. Reads
 *    all source files, sends them to the API in one request, and writes the
 *    generated output. Faster, cheaper, and deterministic compared to agentic.
 *
 * Selection logic (--strategy flag or auto):
 * - "codegen": always use codegen (requires ANTHROPIC_API_KEY)
 * - "claude": always use Claude Agent SDK
 * - "opencode": always use OpenCode SDK
 * - "auto" (default):
 *     1. If explicitly --codegen, use codegen
 *     2. If direction is opencode-to-claude and Claude SDK available, use it
 *     3. If direction is claude-to-opencode and OpenCode SDK available, use it
 *     4. If ANTHROPIC_API_KEY is set, use codegen as fallback
 *     5. Else use whichever agentic SDK is available
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { CodegenConverter } from "./codegen-converter";
import type { CodegenConversionResult } from "./codegen-converter";
import type {
  ConversionDirection,
  ConversionWarning,
  ChangeRecord,
} from "../core/types/common";

// ── SDK Availability Detection ───────────────────────────────────────

interface SDKAvailability {
  claudeAgentSDK: boolean;
  openCodeSDK: boolean;
  anthropicApiKey: boolean;
}

async function detectSDKs(): Promise<SDKAvailability> {
  const result: SDKAvailability = {
    claudeAgentSDK: false,
    openCodeSDK: false,
    anthropicApiKey: !!(process.env.ANTHROPIC_API_KEY),
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

// ── Conversion Strategy Type ─────────────────────────────────────────

export type ConversionStrategy = "claude" | "opencode" | "codegen" | "auto";

// ── Agentic Conversion Interface ─────────────────────────────────────

export interface AgenticConversionOptions {
  direction: ConversionDirection;
  sourcePath: string;
  outputPath: string;
  /** Specific components to convert */
  components?: Array<"hooks" | "skills" | "agents" | "commands" | "mcp">;
  /** Maximum budget for agentic conversion (USD) */
  maxBudgetUsd?: number;
  /** Whether to use AI-powered conversion (falls back to rule-based if false) */
  enabled?: boolean;
  /** Preferred strategy: claude (agent SDK), opencode (agent SDK), codegen (API), or auto */
  preferredStrategy?: ConversionStrategy;
  /** API key for codegen strategy */
  apiKey?: string;
  /** Model for codegen strategy */
  model?: string;
  /** Base URL for codegen (Anthropic-compatible API) */
  baseUrl?: string;
}

export interface AgenticConversionResult {
  strategyUsed: "claude" | "opencode" | "codegen" | "none";
  conversions: AgenticComponentResult[];
  warnings: ConversionWarning[];
  changes: ChangeRecord[];
  totalCostUsd?: number;
  tokenUsage?: { input: number; output: number };
}

interface AgenticComponentResult {
  component: string;
  success: boolean;
  outputFiles: string[];
  reasoning?: string;
}

// ── Main Converter ───────────────────────────────────────────────────

export class AgenticConverter {
  private sdks: SDKAvailability | null = null;

  async convert(
    options: AgenticConversionOptions,
  ): Promise<AgenticConversionResult> {
    if (options.enabled === false) {
      return {
        strategyUsed: "none",
        conversions: [],
        warnings: [
          {
            severity: "info",
            component: "ai-conversion",
            message: "AI-powered conversion disabled; using rule-based conversion only",
          },
        ],
        changes: [],
      };
    }

    this.sdks = await detectSDKs();

    // Override API key availability if explicitly provided
    if (options.apiKey) {
      this.sdks.anthropicApiKey = true;
    }

    const strategy = this.selectStrategy(options);

    if (strategy === "none") {
      return {
        strategyUsed: "none",
        conversions: [],
        warnings: [
          {
            severity: "warning",
            component: "ai-conversion",
            message:
              "No AI conversion strategy available. Options: " +
              "(1) set ANTHROPIC_API_KEY for codegen, " +
              "(2) install @anthropic-ai/claude-agent-sdk, " +
              "(3) install @opencode-ai/sdk",
            suggestion:
              "Fastest: export ANTHROPIC_API_KEY=sk-ant-... then use --codegen",
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

    switch (strategy) {
      case "codegen":
        return this.convertWithCodegen(options, components);
      case "claude":
        return this.convertWithClaudeSDK(options, components);
      case "opencode":
        return this.convertWithOpenCodeSDK(options, components);
      default:
        // Unreachable, but satisfy TypeScript
        return { strategyUsed: "none", conversions: [], warnings: [], changes: [] };
    }
  }

  private selectStrategy(
    options: AgenticConversionOptions,
  ): "claude" | "opencode" | "codegen" | "none" {
    const sdks = this.sdks!;
    const pref = options.preferredStrategy || "auto";

    // Explicit strategy requested
    if (pref === "codegen") {
      if (sdks.anthropicApiKey) return "codegen";
      // Can't use codegen without API key — try to fall back
    }
    if (pref === "claude" && sdks.claudeAgentSDK) return "claude";
    if (pref === "opencode" && sdks.openCodeSDK) return "opencode";

    // Auto-select
    if (pref === "auto" || pref === "codegen") {
      // Prefer agentic SDKs when available (richer, multi-turn)
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

      // Fall back to codegen if API key available
      if (sdks.anthropicApiKey) return "codegen";

      // Last resort: any agentic SDK
      if (sdks.claudeAgentSDK) return "claude";
      if (sdks.openCodeSDK) return "opencode";
    }

    return "none";
  }

  // ── Codegen Strategy ─────────────────────────────────────────────

  private async convertWithCodegen(
    options: AgenticConversionOptions,
    components: string[],
  ): Promise<AgenticConversionResult> {
    const codegen = new CodegenConverter();
    const result = await codegen.convert({
      direction: options.direction,
      sourcePath: options.sourcePath,
      outputPath: options.outputPath,
      components: components as Array<"hooks" | "skills" | "agents" | "commands" | "mcp">,
      apiKey: options.apiKey,
      model: options.model,
      baseUrl: options.baseUrl,
    });

    // Map CodegenConversionResult → AgenticConversionResult
    return {
      strategyUsed: "codegen",
      conversions: result.conversions.map((c) => ({
        component: c.component,
        success: c.success,
        outputFiles: c.files.map((f) => f.path),
        reasoning: c.reasoning,
      })),
      warnings: result.warnings,
      changes: result.changes,
      tokenUsage: {
        input: result.inputTokens,
        output: result.outputTokens,
      },
    };
  }

  // ── Claude Agent SDK Strategy ────────────────────────────────────

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
      strategyUsed: "claude",
      conversions,
      warnings,
      changes,
    };
  }

  // ── OpenCode SDK Strategy ────────────────────────────────────────

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
      strategyUsed: "opencode",
      conversions,
      warnings,
      changes,
    };
  }

  // ── Prompt Building (shared by agentic strategies) ────────────────

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

// ── System Prompt for Agentic Strategies ─────────────────────────────

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
