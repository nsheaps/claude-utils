/**
 * Converts agent definitions between Claude Code and OpenCode.
 *
 * Claude Code: agents/*.md (markdown files with agent instructions)
 * OpenCode: .opencode/agents/*.md or config.agents (code-based with provider info)
 */

import type { ClaudeCodeAgent } from "../core/types/claude-code";
import type { OpenCodeAgent } from "../core/types/open-code";
import type { ConversionWarning } from "../core/types/common";

// ── Claude Code Agents → OpenCode Agents ─────────────────────────────

export function convertClaudeAgentsToOpenCode(
  agents: ClaudeCodeAgent[],
): { agents: Record<string, OpenCodeAgent>; warnings: ConversionWarning[] } {
  const result: Record<string, OpenCodeAgent> = {};
  const warnings: ConversionWarning[] = [];

  for (const agent of agents) {
    // OpenCode agents need provider/model info that Claude Code agents don't have
    result[agent.name] = {
      name: agent.name,
      description: extractDescription(agent.content),
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      instructions: agent.content,
    };

    warnings.push({
      severity: "info",
      component: "agents",
      message: `Agent "${agent.name}" defaults to anthropic/claude-sonnet; update provider and model as needed`,
      suggestion: `OpenCode supports multiple providers; configure the preferred model in opencode.json`,
    });
  }

  return { agents: result, warnings };
}

// ── OpenCode Agents → Claude Code Agents ─────────────────────────────

export function convertOpenCodeAgentsToClaude(
  agents: Record<string, OpenCodeAgent>,
): { agents: ClaudeCodeAgent[]; warnings: ConversionWarning[] } {
  const result: ClaudeCodeAgent[] = [];
  const warnings: ConversionWarning[] = [];

  for (const [name, agent] of Object.entries(agents)) {
    let content = typeof agent.instructions === "string"
      ? agent.instructions
      : JSON.stringify(agent.instructions, null, 2);

    // Preserve provider/model info as frontmatter
    if (agent.provider !== "anthropic" || agent.model !== "claude-sonnet-4-20250514") {
      const meta = `<!-- Original provider: ${agent.provider}, model: ${agent.model} -->\n\n`;
      content = meta + content;
      warnings.push({
        severity: "warning",
        component: "agents",
        message: `Agent "${name}" uses ${agent.provider}/${agent.model}; Claude Code only supports Anthropic models`,
        suggestion: `The agent will use Claude's default model; original provider info preserved as HTML comment`,
      });
    }

    // Note tool restrictions if any
    if (agent.tools && agent.tools.length > 0) {
      warnings.push({
        severity: "info",
        component: "agents",
        message: `Agent "${name}" has tool restrictions [${agent.tools.join(", ")}]; use hooks to enforce in Claude Code`,
      });
    }

    result.push({
      name,
      path: `agents/${name}.md`,
      content,
    });
  }

  return { agents: result, warnings };
}

// ── Helpers ──────────────────────────────────────────────────────────

function extractDescription(markdown: string): string {
  // Try to extract first heading or first paragraph as description
  const headingMatch = markdown.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1];

  const paragraphMatch = markdown.match(/^([^\n#].+)$/m);
  if (paragraphMatch) return paragraphMatch[1].slice(0, 200);

  return "";
}
