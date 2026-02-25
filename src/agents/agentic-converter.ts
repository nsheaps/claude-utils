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
 * 3. **One-Shot (Anthropic Messages API)** — Single-shot code generation. Reads
 *    all source files, sends them to the API in one request, and writes the
 *    generated output. Faster, cheaper, and deterministic compared to agentic.
 *
 * 4. **Codegen (AST/Template)** — Programmatic code generation using the
 *    TypeScript compiler API. No AI, no API keys. Produces syntactically
 *    correct TypeScript via AST manipulation.
 *
 * 5. **Free (OpenRouter)** — One-shot conversion via OpenRouter's free models.
 *    Requires OPENROUTER_API_KEY but no cost. Interactive setup wizard if missing.
 *
 * Selection logic (--strategy flag or auto):
 * - "codegen": use AST-based codegen (no AI, free)
 * - "free": use one-shot via OpenRouter free models (requires OPENROUTER_API_KEY)
 * - "oneshot": always use one-shot (requires ANTHROPIC_API_KEY)
 * - "claude": always use Claude Agent SDK
 * - "opencode": always use OpenCode SDK
 * - "auto" (default):
 *     1. If direction matches an installed agentic SDK, use it
 *     2. If ANTHROPIC_API_KEY is set, use one-shot
 *     3. If OPENROUTER_API_KEY is set, use free
 *     4. Fall back to codegen (always available)
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { OneShotConverter } from "./oneshot-converter";
import type { OneShotConversionResult } from "./oneshot-converter";
import { CodegenConverter } from "../codegen/codegen-strategy";
import type { CodegenConversionResult } from "../codegen/codegen-strategy";
import { getApiKey } from "../config/config-manager";
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
  openrouterApiKey: boolean;
}

async function detectSDKs(): Promise<SDKAvailability> {
  const result: SDKAvailability = {
    claudeAgentSDK: false,
    openCodeSDK: false,
    anthropicApiKey: !!(process.env.ANTHROPIC_API_KEY),
    openrouterApiKey: !!(process.env.OPENROUTER_API_KEY),
  };

  // Also check config file for API keys
  try {
    const anthropicKey = await getApiKey("anthropic");
    if (anthropicKey) result.anthropicApiKey = true;
    const openrouterKey = await getApiKey("openrouter");
    if (openrouterKey) result.openrouterApiKey = true;
  } catch {
    // Config file not available
  }

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

export type ConversionStrategy = "claude" | "opencode" | "oneshot" | "codegen" | "free" | "auto";

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
  /** Preferred strategy: claude, opencode, oneshot, codegen, free, or auto */
  preferredStrategy?: ConversionStrategy;
  /** API key for one-shot strategy */
  apiKey?: string;
  /** Model for one-shot strategy */
  model?: string;
  /** Base URL for one-shot (Anthropic-compatible API) */
  baseUrl?: string;
}

export interface AgenticConversionResult {
  strategyUsed: "claude" | "opencode" | "oneshot" | "codegen" | "free" | "none";
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
              "No conversion strategy available. Options: " +
              "(1) use --codegen for AST-based (free, no API key), " +
              "(2) use --free with OPENROUTER_API_KEY (free AI models), " +
              "(3) set ANTHROPIC_API_KEY for --oneshot, " +
              "(4) install @anthropic-ai/claude-agent-sdk, " +
              "(5) install @opencode-ai/sdk",
            suggestion:
              "Fastest: use --codegen (free, no API key). Smartest free: use --free with OpenRouter.",
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
      case "oneshot":
        return this.convertWithOneShot(options, components);
      case "free":
        return this.convertWithFree(options, components);
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
  ): "claude" | "opencode" | "oneshot" | "codegen" | "free" | "none" {
    const sdks = this.sdks!;
    const pref = options.preferredStrategy || "auto";

    // Explicit strategy requested
    if (pref === "codegen") return "codegen"; // Always available, no deps
    if (pref === "free") {
      if (sdks.openrouterApiKey) return "free";
      // Can't use free without OpenRouter API key — try to fall back
    }
    if (pref === "oneshot") {
      if (sdks.anthropicApiKey) return "oneshot";
      // Can't use one-shot without API key — try to fall back
    }
    if (pref === "claude" && sdks.claudeAgentSDK) return "claude";
    if (pref === "opencode" && sdks.openCodeSDK) return "opencode";

    // Auto-select
    if (pref === "auto" || pref === "oneshot" || pref === "free") {
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

      // Fall back to one-shot if Anthropic API key available
      if (sdks.anthropicApiKey) return "oneshot";

      // Fall back to free if OpenRouter API key available
      if (sdks.openrouterApiKey) return "free";

      // Fall back to codegen (always available, no API key needed)
      return "codegen";
    }

    return "none";
  }

  // ── Codegen Strategy (AST-based, no AI) ─────────────────────────

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
    });

    return {
      strategyUsed: "codegen",
      conversions: result.conversions.map((c) => ({
        component: c.component,
        success: c.success,
        outputFiles: c.files,
      })),
      warnings: result.warnings,
      changes: result.changes,
    };
  }

  // ── One-Shot Strategy ─────────────────────────────────────────────

  private async convertWithOneShot(
    options: AgenticConversionOptions,
    components: string[],
  ): Promise<AgenticConversionResult> {
    const oneshot = new OneShotConverter();
    const result = await oneshot.convert({
      direction: options.direction,
      sourcePath: options.sourcePath,
      outputPath: options.outputPath,
      components: components as Array<"hooks" | "skills" | "agents" | "commands" | "mcp">,
      apiKey: options.apiKey,
      model: options.model,
      baseUrl: options.baseUrl,
    });

    // Map OneShotConversionResult → AgenticConversionResult
    return {
      strategyUsed: "oneshot",
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

  // ── Free Strategy (OpenRouter) ───────────────────────────────────

  private async convertWithFree(
    options: AgenticConversionOptions,
    components: string[],
  ): Promise<AgenticConversionResult> {
    // Free strategy = one-shot via OpenRouter with free models
    const apiKey = options.apiKey || await getApiKey("openrouter") || "";

    if (!apiKey) {
      return {
        strategyUsed: "free",
        conversions: [],
        warnings: [
          {
            severity: "warning",
            component: "free",
            message:
              "No OpenRouter API key available. Set OPENROUTER_API_KEY or run 'plugin-convert setup'.",
            suggestion:
              "export OPENROUTER_API_KEY=sk-or-... or run: plugin-convert setup",
          },
        ],
        changes: [],
      };
    }

    const oneshot = new OneShotConverter();
    const result = await oneshot.convert({
      direction: options.direction,
      sourcePath: options.sourcePath,
      outputPath: options.outputPath,
      components: components as Array<"hooks" | "skills" | "agents" | "commands" | "mcp">,
      apiKey,
      model: options.model || "openrouter/auto",
      baseUrl: "https://openrouter.ai/api/v1",
    });

    return {
      strategyUsed: "free",
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
