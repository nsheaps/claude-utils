/**
 * Converts skills/instructions between Claude Code and OpenCode.
 *
 * Claude Code: skills/ directory with SKILL.md files and optional references/
 * OpenCode: instructions/ directory with README.md files, or .opencode/agents/*.md
 */

import type { ClaudeCodeSkill } from "../core/types/claude-code";
import type { OpenCodeInstruction } from "../core/types/open-code";
import type { ConversionWarning } from "../core/types/common";

// ── Claude Code Skills → OpenCode Instructions ──────────────────────

export function convertClaudeSkillsToOpenCode(
  skills: ClaudeCodeSkill[],
): { instructions: OpenCodeInstruction[]; warnings: ConversionWarning[] } {
  const instructions: OpenCodeInstruction[] = [];
  const warnings: ConversionWarning[] = [];

  for (const skill of skills) {
    // Convert SKILL.md content to OpenCode instruction format
    let content = skill.content;

    // Replace Claude Code-specific references
    content = content.replace(
      /\/plugin-name:skill-name/g,
      "/skill-name",
    );

    // Note if there are references that need manual handling
    if (skill.references && skill.references.length > 0) {
      warnings.push({
        severity: "info",
        component: "skills",
        message: `Skill "${skill.name}" has ${skill.references.length} reference file(s) that need manual migration`,
        suggestion: `Copy reference files to the instruction directory and update paths`,
      });
    }

    instructions.push({
      name: skill.name,
      path: `instructions/${skill.name}/README.md`,
      content,
    });
  }

  return { instructions, warnings };
}

// ── OpenCode Instructions → Claude Code Skills ──────────────────────

export function convertOpenCodeSkillsToClaude(
  instructions: OpenCodeInstruction[],
): { skills: ClaudeCodeSkill[]; warnings: ConversionWarning[] } {
  const skills: ClaudeCodeSkill[] = [];
  const warnings: ConversionWarning[] = [];

  for (const instruction of instructions) {
    let content = instruction.content;

    // Add activation triggers as metadata comment if present
    if (instruction.triggers && instruction.triggers.length > 0) {
      const triggerNote = `<!-- OpenCode triggers: ${instruction.triggers.join(", ")} -->\n\n`;
      content = triggerNote + content;
      warnings.push({
        severity: "info",
        component: "skills",
        message: `Instruction "${instruction.name}" has triggers [${instruction.triggers.join(", ")}] preserved as HTML comments`,
        suggestion: `Claude Code skills activate automatically; consider adding trigger keywords to the skill content`,
      });
    }

    skills.push({
      name: instruction.name,
      path: `skills/${instruction.name}/SKILL.md`,
      content,
      references: [],
    });
  }

  return { skills, warnings };
}
