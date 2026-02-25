/**
 * One-shot conversion strategy.
 *
 * Instead of running an agentic loop (Claude Agent SDK or OpenCode SDK),
 * this approach calls the Anthropic Messages API directly with structured
 * prompts and uses the response to generate converted files.
 *
 * Advantages over agentic:
 * - Deterministic: single API call per component, no tool-use loop
 * - Cheaper: one request instead of multiple agentic turns
 * - Faster: no back-and-forth; prompt includes all source content inline
 * - Offline-friendly: can use cached responses or local models
 *
 * The one-shot converter reads all source files, embeds them into a
 * structured prompt, and asks the model to return the converted files
 * as a JSON structure that we then write to disk.
 */

import { readFile, writeFile, readdir, stat, mkdir } from "fs/promises";
import { join, relative, basename } from "path";
import { HOOK_EVENT_MAPPINGS } from "../core/types/common";
import type {
  ConversionDirection,
  ConversionWarning,
  ChangeRecord,
} from "../core/types/common";

// ── Types ────────────────────────────────────────────────────────────

export interface OneShotConversionOptions {
  direction: ConversionDirection;
  sourcePath: string;
  outputPath: string;
  /** Specific components to convert via one-shot */
  components?: Array<"hooks" | "skills" | "agents" | "commands" | "mcp">;
  /** API key — defaults to ANTHROPIC_API_KEY env var */
  apiKey?: string;
  /** Model to use for one-shot conversion */
  model?: string;
  /** Max tokens for the response */
  maxTokens?: number;
  /** Base URL for Anthropic-compatible API */
  baseUrl?: string;
}

export interface OneShotConversionResult {
  strategy: "oneshot";
  model: string;
  conversions: OneShotComponentResult[];
  warnings: ConversionWarning[];
  changes: ChangeRecord[];
  inputTokens: number;
  outputTokens: number;
}

interface OneShotComponentResult {
  component: string;
  success: boolean;
  files: GeneratedFile[];
  reasoning?: string;
}

interface GeneratedFile {
  path: string;
  content: string;
}

interface CollectedSource {
  component: string;
  files: Array<{ path: string; content: string }>;
}

// ── Anthropic API client (minimal, no SDK dependency) ────────────────

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | Array<{ type: "text"; text: string }>;
}

interface AnthropicResponse {
  content: Array<{ type: "text"; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
  stop_reason: string;
}

async function callAnthropicAPI(
  messages: AnthropicMessage[],
  options: {
    apiKey: string;
    model: string;
    maxTokens: number;
    system: string;
    baseUrl: string;
  },
): Promise<AnthropicResponse> {
  const response = await fetch(`${options.baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": options.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: options.model,
      max_tokens: options.maxTokens,
      system: options.system,
      messages,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic API error (${response.status}): ${body}`);
  }

  return (await response.json()) as AnthropicResponse;
}

// ── Main One-Shot Converter ──────────────────────────────────────────

export class OneShotConverter {
  async convert(
    options: OneShotConversionOptions,
  ): Promise<OneShotConversionResult> {
    const apiKey =
      options.apiKey || process.env.ANTHROPIC_API_KEY || "";
    const model = options.model || "claude-sonnet-4-20250514";
    const maxTokens = options.maxTokens || 8192;
    const baseUrl =
      options.baseUrl || process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";

    if (!apiKey) {
      return {
        strategy: "oneshot",
        model,
        conversions: [],
        warnings: [
          {
            severity: "warning",
            component: "oneshot",
            message:
              "No API key available. Set ANTHROPIC_API_KEY or pass --api-key for one-shot conversion.",
            suggestion:
              "export ANTHROPIC_API_KEY=sk-ant-... or use --api-key flag",
          },
        ],
        changes: [],
        inputTokens: 0,
        outputTokens: 0,
      };
    }

    const components = options.components || [
      "hooks",
      "skills",
      "agents",
      "commands",
      "mcp",
    ];

    const conversions: OneShotComponentResult[] = [];
    const warnings: ConversionWarning[] = [];
    const changes: ChangeRecord[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Collect all source files for the requested components
    const sources = await this.collectSources(
      options.sourcePath,
      options.direction,
      components,
    );

    // Convert each component with a single API call
    for (const source of sources) {
      if (source.files.length === 0) {
        warnings.push({
          severity: "info",
          component: source.component,
          message: `No source files found for "${source.component}"; skipping one-shot`,
        });
        continue;
      }

      try {
        const systemPrompt = buildOneShotSystemPrompt(
          source.component,
          options.direction,
        );

        const userPrompt = buildOneShotUserPrompt(
          source.component,
          source.files,
          options.direction,
          options.outputPath,
        );

        const response = await callAnthropicAPI(
          [{ role: "user", content: userPrompt }],
          { apiKey, model, maxTokens, system: systemPrompt, baseUrl },
        );

        totalInputTokens += response.usage.input_tokens;
        totalOutputTokens += response.usage.output_tokens;

        const responseText = response.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("");

        // Parse the generated files from the response
        const { files, reasoning } = parseOneShotResponse(responseText);

        // Write generated files to disk
        for (const file of files) {
          const fullPath = join(options.outputPath, file.path);
          await mkdir(join(fullPath, ".."), { recursive: true });
          await writeFile(fullPath, file.content);
        }

        conversions.push({
          component: source.component,
          success: true,
          files,
          reasoning,
        });

        changes.push({
          type: "modified",
          component: source.component,
          sourcePath: options.sourcePath,
          targetPath: options.outputPath,
          description: `One-shot converted ${source.component} (${files.length} files) via ${model}`,
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error);
        warnings.push({
          severity: "error",
          component: source.component,
          message: `One-shot failed for "${source.component}": ${message}`,
          suggestion: "Check API key, network, and model availability",
        });

        conversions.push({
          component: source.component,
          success: false,
          files: [],
          reasoning: message,
        });
      }
    }

    return {
      strategy: "oneshot",
      model,
      conversions,
      warnings,
      changes,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    };
  }

  // ── Source Collection ─────────────────────────────────────────────

  private async collectSources(
    sourcePath: string,
    direction: ConversionDirection,
    components: string[],
  ): Promise<CollectedSource[]> {
    const sources: CollectedSource[] = [];
    const isClaudeSource = direction === "claude-to-opencode";

    const componentDirs: Record<string, string[]> = isClaudeSource
      ? {
          hooks: ["hooks"],
          skills: ["skills"],
          agents: ["agents"],
          commands: ["commands"],
          mcp: ["."],
        }
      : {
          hooks: [".opencode/plugins"],
          skills: ["instructions"],
          agents: [".opencode/agents"],
          commands: ["commands"],
          mcp: ["."],
        };

    for (const component of components) {
      const dirs = componentDirs[component] || [component];
      const files: Array<{ path: string; content: string }> = [];

      for (const dir of dirs) {
        const fullDir = join(sourcePath, dir);
        const collected = await this.readDirRecursive(fullDir, sourcePath);

        // For MCP, only include config files
        if (component === "mcp") {
          const mcpFiles = collected.filter(
            (f) =>
              f.path === ".mcp.json" ||
              f.path === "opencode.json" ||
              f.path === "settings.json",
          );
          files.push(...mcpFiles);
        } else {
          files.push(...collected);
        }
      }

      sources.push({ component, files });
    }

    return sources;
  }

  private async readDirRecursive(
    dir: string,
    rootPath: string,
  ): Promise<Array<{ path: string; content: string }>> {
    const results: Array<{ path: string; content: string }> = [];

    try {
      const info = await stat(dir);
      if (info.isFile()) {
        const content = await readFile(dir, "utf-8");
        return [{ path: relative(rootPath, dir), content }];
      }
    } catch {
      return results;
    }

    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        if (entry.isFile()) {
          // Skip binary/large files
          const ext = entry.name.split(".").pop() || "";
          if (["md", "json", "ts", "js", "sh", "yaml", "yml", "toml"].includes(ext)) {
            try {
              const content = await readFile(fullPath, "utf-8");
              if (content.length < 50000) {
                results.push({ path: relative(rootPath, fullPath), content });
              }
            } catch {
              // Skip unreadable files
            }
          }
        } else if (entry.isDirectory() && !entry.name.startsWith(".")) {
          const subResults = await this.readDirRecursive(fullPath, rootPath);
          results.push(...subResults);
        }
      }
    } catch {
      // Directory doesn't exist or can't be read
    }

    return results;
  }
}

// ── Prompt Construction ──────────────────────────────────────────────

function buildOneShotSystemPrompt(
  component: string,
  direction: ConversionDirection,
): string {
  const isClaudeToOpenCode = direction === "claude-to-opencode";
  const sourceFormat = isClaudeToOpenCode ? "Claude Code" : "OpenCode";
  const targetFormat = isClaudeToOpenCode ? "OpenCode" : "Claude Code";

  const hookMappingTable = HOOK_EVENT_MAPPINGS.map(
    (m) => `  ${m.claudeCode} ↔ ${m.openCode} (${m.description})`,
  ).join("\n");

  return `You are a plugin conversion code generator. You convert ${sourceFormat} plugin components to ${targetFormat} format.

You receive source files and produce the exact converted output files.

## Format Knowledge

### Claude Code Plugin Structure
- Manifest: .claude-plugin/plugin.json
- Skills: skills/*/SKILL.md (markdown, auto-activated by content matching)
- Commands: commands/*.md (markdown with YAML frontmatter)
- Agents: agents/*.md (markdown with system prompts)
- Hooks: hooks/hooks.json (declarative JSON: event → matcher → shell commands)
- MCP: .mcp.json (mcpServers object with command/args/env)
- Settings: settings.json (hooks, mcpServers, env, permissions)

### OpenCode Plugin Structure
- Config: opencode.json (name, version, hooks, mcpServers, agents, commands)
- Instructions: instructions/*/README.md (like skills)
- Commands: commands/*.ts (TypeScript modules with handler functions)
- Agents: .opencode/agents/*.md (markdown + provider/model in config)
- Hooks: .opencode/plugins/*.ts (TypeScript event subscriptions)
- MCP: mcpServers in opencode.json (adds transport/url fields)

### Hook Event Mapping
${hookMappingTable}

### Key Conversion Rules
1. Claude Code hooks use JSON matchers + shell commands; OpenCode uses TypeScript event handlers
2. Claude Code SKILL.md → OpenCode instructions/*/README.md (preserve content)
3. Claude Code markdown commands → OpenCode TypeScript command stubs
4. Claude Code markdown agents → OpenCode agents need provider/model config
5. MCP: OpenCode adds "transport" field (default "stdio") and optional "url"
6. Env var: \${CLAUDE_PLUGIN_ROOT} ↔ \${OPENCODE_PLUGIN_ROOT}

## Response Format

You MUST respond with a JSON object containing:
- "reasoning": brief explanation of conversion decisions
- "files": array of { "path": relative file path, "content": file contents }
- "warnings": array of strings noting any lossy or manual-review items

Example:
\`\`\`json
{
  "reasoning": "Converted 2 PreToolUse hooks to tool.execute.before subscriptions...",
  "files": [
    { "path": ".opencode/plugins/hooks.ts", "content": "import ..." }
  ],
  "warnings": ["Inline handler at line 15 needs manual review"]
}
\`\`\`

Respond ONLY with the JSON object. No markdown fences, no extra text.`;
}

function buildOneShotUserPrompt(
  component: string,
  files: Array<{ path: string; content: string }>,
  direction: ConversionDirection,
  outputPath: string,
): string {
  const isClaudeToOpenCode = direction === "claude-to-opencode";
  const targetFormat = isClaudeToOpenCode ? "OpenCode" : "Claude Code";

  const filesList = files
    .map((f) => `### ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
    .join("\n\n");

  const componentInstructions: Record<string, string> = {
    hooks: isClaudeToOpenCode
      ? `Convert the Claude Code hook configuration to an OpenCode TypeScript plugin.
Each hook matcher should become a client.event.subscribe() call.
Shell commands should be wrapped in execSync() with the event passed via OPENCODE_EVENT env var.
Permission decisions (allow/deny/ask) should use the appropriate OpenCode event reply mechanism.`
      : `Convert the OpenCode hook subscriptions to Claude Code hooks/hooks.json format.
Each event subscription becomes a hook matcher entry.
TypeScript handlers need shell wrapper scripts (bun run <handler>).
Map OpenCode events back to Claude Code event names (beforeTool → PreToolUse, etc.)`,

    skills: isClaudeToOpenCode
      ? `Convert each SKILL.md to an OpenCode instruction README.md.
Preserve all markdown content. Place each in instructions/<name>/README.md.
Update any Claude Code-specific references (plugin namespacing, tool names).`
      : `Convert each instruction README.md to a Claude Code SKILL.md.
Preserve all markdown content. Place each in skills/<name>/SKILL.md.
Update any OpenCode-specific references.`,

    agents: isClaudeToOpenCode
      ? `Convert Claude Code agent markdown files to OpenCode agent format.
OpenCode agents need provider/model config in opencode.json and markdown in .opencode/agents/.
Default to provider: "anthropic", model: "claude-sonnet-4-20250514" unless content suggests otherwise.`
      : `Convert OpenCode agents to Claude Code agent markdown files in agents/.
Preserve the instruction content. Note any provider/model info as HTML comments.
Claude Code agents are pure markdown without provider configuration.`,

    commands: isClaudeToOpenCode
      ? `Convert Claude Code markdown commands (with YAML frontmatter) to OpenCode TypeScript modules.
Each command becomes a commands/<name>.ts file exporting { name, description, handler }.
Extract parameters from frontmatter. Generate a working handler stub.`
      : `Convert OpenCode TypeScript commands to Claude Code markdown commands in commands/.
Each becomes a commands/<name>.md with YAML frontmatter (name, description, parameters).
Preserve parameter definitions. Handler logic becomes documentation in the markdown body.`,

    mcp: isClaudeToOpenCode
      ? `Convert .mcp.json or settings.json mcpServers to OpenCode format in opencode.json.
Add transport: "stdio" to each server. Map CLAUDE_PLUGIN_ROOT to OPENCODE_PLUGIN_ROOT.
Detect HTTP servers and set transport: "http" with url field.`
      : `Convert opencode.json mcpServers to Claude Code .mcp.json format.
Remove transport/url fields (Claude Code only supports stdio natively).
Map OPENCODE_PLUGIN_ROOT to CLAUDE_PLUGIN_ROOT. Note non-stdio servers in warnings.`,
  };

  return `Convert the following ${component} source files to ${targetFormat} format.

${componentInstructions[component] || `Convert the ${component} files to ${targetFormat} format.`}

## Source Files

${filesList}

Generate the converted output files. Respond with the JSON object only.`;
}

// ── Response Parsing ─────────────────────────────────────────────────

function parseOneShotResponse(text: string): {
  files: GeneratedFile[];
  reasoning?: string;
  warnings?: string[];
} {
  // Try to extract JSON from the response — handle markdown fences if present
  let jsonText = text.trim();

  // Strip markdown code fences if the model wrapped it
  const fenceMatch = jsonText.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    jsonText = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(jsonText);
    return {
      files: (parsed.files || []).map((f: { path: string; content: string }) => ({
        path: f.path,
        content: f.content,
      })),
      reasoning: parsed.reasoning,
      warnings: parsed.warnings,
    };
  } catch {
    // If JSON parsing fails, try to extract file blocks from the text
    return extractFilesFromText(text);
  }
}

/**
 * Fallback parser: extracts file contents from markdown-style code blocks
 * when the model doesn't return valid JSON.
 */
function extractFilesFromText(text: string): {
  files: GeneratedFile[];
  reasoning?: string;
} {
  const files: GeneratedFile[] = [];

  // Match patterns like: ### path/to/file.ts\n```\ncontent\n```
  const blockPattern = /###\s+([^\n]+)\n```[^\n]*\n([\s\S]*?)```/g;
  let match: RegExpExecArray | null;

  while ((match = blockPattern.exec(text)) !== null) {
    files.push({
      path: match[1].trim(),
      content: match[2],
    });
  }

  // Also try: **path/to/file.ts**\n```\ncontent\n```
  const boldPattern = /\*\*([^*]+)\*\*\n```[^\n]*\n([\s\S]*?)```/g;
  while ((match = boldPattern.exec(text)) !== null) {
    const path = match[1].trim();
    // Avoid duplicates
    if (!files.some((f) => f.path === path)) {
      files.push({ path, content: match[2] });
    }
  }

  return {
    files,
    reasoning: files.length > 0 ? "Extracted from non-JSON response" : "Failed to parse response",
  };
}
