/**
 * Converts commands between Claude Code and OpenCode.
 *
 * Claude Code: commands/*.md (markdown with optional frontmatter)
 * OpenCode: commands/*.ts (TypeScript modules exporting command objects)
 */

import type { ClaudeCodeCommand } from "../core/types/claude-code";
import type { OpenCodeCommand } from "../core/types/open-code";
import type { ConversionWarning } from "../core/types/common";

// ── Claude Code Commands → OpenCode Commands ─────────────────────────

export function convertClaudeCommandsToOpenCode(
  commands: ClaudeCodeCommand[],
): { commands: OpenCodeCommand[]; warnings: ConversionWarning[] } {
  const result: OpenCodeCommand[] = [];
  const warnings: ConversionWarning[] = [];

  for (const cmd of commands) {
    result.push({
      name: cmd.name,
      aliases: cmd.aliases,
      description: cmd.description,
      handler: `commands/${cmd.name}.ts`,
      parameters: cmd.parameters?.map((p) => ({
        name: p.name,
        type: p.type,
        description: p.description,
        required: p.required,
      })),
    });

    warnings.push({
      severity: "info",
      component: "commands",
      message: `Command "${cmd.name}" converted to TypeScript stub; implement handler logic`,
      suggestion: `The markdown content has been preserved as a comment in the generated file`,
    });
  }

  return { commands: result, warnings };
}

// ── OpenCode Commands → Claude Code Commands ─────────────────────────

export function convertOpenCodeCommandsToClaude(
  commands: OpenCodeCommand[],
): { commands: ClaudeCodeCommand[]; warnings: ConversionWarning[] } {
  const result: ClaudeCodeCommand[] = [];
  const warnings: ConversionWarning[] = [];

  for (const cmd of commands) {
    result.push({
      name: cmd.name,
      aliases: cmd.aliases,
      description: cmd.description,
      parameters: cmd.parameters?.map((p) => ({
        name: p.name,
        type: p.type,
        description: p.description,
        required: p.required,
      })),
      content: generateCommandMarkdown(cmd),
      path: `commands/${cmd.name}.md`,
    });

    if (cmd.handler) {
      warnings.push({
        severity: "info",
        component: "commands",
        message: `Command "${cmd.name}" had a TypeScript handler at "${cmd.handler}"; converted to markdown`,
        suggestion: `Claude Code commands are markdown-based; handler logic must be implemented via hooks or MCP tools`,
      });
    }
  }

  return { commands: result, warnings };
}

function generateCommandMarkdown(cmd: OpenCodeCommand): string {
  const parts: string[] = [];

  parts.push(`# ${cmd.name}`);
  parts.push("");
  if (cmd.description) {
    parts.push(cmd.description);
    parts.push("");
  }

  if (cmd.parameters && cmd.parameters.length > 0) {
    parts.push("## Parameters");
    parts.push("");
    for (const param of cmd.parameters) {
      const required = param.required ? " (required)" : " (optional)";
      parts.push(`- \`${param.name}\` (${param.type})${required}: ${param.description}`);
    }
    parts.push("");
  }

  parts.push("<!-- Converted from OpenCode TypeScript command -->");

  return parts.join("\n");
}
