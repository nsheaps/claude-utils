/**
 * Converts hooks between Claude Code and OpenCode formats.
 *
 * Claude Code uses declarative JSON hook matchers with shell commands.
 * OpenCode uses event subscriptions in TypeScript plugin modules.
 */

import { HOOK_EVENT_MAPPINGS } from "../core/types/common";
import type {
  ClaudeCodeHooks,
  ClaudeCodeHookEvent,
  ClaudeCodeHookMatcher,
} from "../core/types/claude-code";
import type {
  OpenCodeHookConfig,
  OpenCodeHookEvent,
} from "../core/types/open-code";
import type { ConversionWarning } from "../core/types/common";

// ── Claude Code → OpenCode ───────────────────────────────────────────

export function convertClaudeHooksToOpenCode(
  hooks: ClaudeCodeHooks,
): { hooks: OpenCodeHookConfig[]; warnings: ConversionWarning[] } {
  const result: OpenCodeHookConfig[] = [];
  const warnings: ConversionWarning[] = [];

  for (const [eventName, matchers] of Object.entries(hooks)) {
    const mapping = HOOK_EVENT_MAPPINGS.find(
      (m) => m.claudeCode === eventName,
    );

    if (!mapping) {
      warnings.push({
        severity: "warning",
        component: "hooks",
        message: `No OpenCode equivalent for Claude Code hook event "${eventName}"`,
        suggestion: `Consider implementing this as a custom event handler in an OpenCode plugin`,
      });
      continue;
    }

    const openCodeEvent = mapping.openCode as OpenCodeHookEvent;

    for (const matcher of matchers as ClaudeCodeHookMatcher[]) {
      for (const hook of matcher.hooks) {
        const config: OpenCodeHookConfig = {
          event: openCodeEvent,
          command: hook.command,
          timeout: hook.timeout,
        };

        // Convert matcher pattern to OpenCode pattern format
        if (matcher.matcher) {
          config.pattern = matcher.matcher;
        }

        result.push(config);
      }

      if (!mapping.bidirectional) {
        warnings.push({
          severity: "info",
          component: "hooks",
          message: `Hook "${eventName}" → "${openCodeEvent}" is a one-way mapping; semantics may differ`,
          suggestion: `Review the converted hook behavior in OpenCode`,
        });
      }
    }
  }

  return { hooks: result, warnings };
}

// ── OpenCode → Claude Code ───────────────────────────────────────────

export function convertOpenCodeHooksToClaude(
  hooks: OpenCodeHookConfig[],
): { hooks: ClaudeCodeHooks; warnings: ConversionWarning[] } {
  const result: ClaudeCodeHooks = {};
  const warnings: ConversionWarning[] = [];

  for (const hook of hooks) {
    const mapping = HOOK_EVENT_MAPPINGS.find(
      (m) => m.openCode === hook.event,
    );

    if (!mapping) {
      warnings.push({
        severity: "warning",
        component: "hooks",
        message: `No Claude Code equivalent for OpenCode hook event "${hook.event}"`,
        suggestion: `Consider implementing this as a custom PreToolUse/PostToolUse hook`,
      });
      continue;
    }

    const claudeEvent = mapping.claudeCode as ClaudeCodeHookEvent;

    // OpenCode hooks with TypeScript handlers need shell command wrappers
    let command: string;
    if (hook.command) {
      command = hook.command;
    } else if (hook.script) {
      command = hook.script;
    } else if (hook.handler) {
      // TypeScript handlers need a wrapper script
      warnings.push({
        severity: "warning",
        component: "hooks",
        message: `OpenCode TypeScript handler "${hook.handler}" needs a shell wrapper for Claude Code`,
        suggestion: `Create a shell script that invokes the handler: bun run ${hook.handler}`,
      });
      command = `bun run ${hook.handler}`;
    } else {
      warnings.push({
        severity: "info",
        component: "hooks",
        message: `Inline plugin hook for "${hook.event}" cannot be directly converted`,
        suggestion: `Extract the handler logic into a standalone script`,
      });
      continue;
    }

    if (!result[claudeEvent]) {
      result[claudeEvent] = [];
    }

    const matcher: ClaudeCodeHookMatcher = {
      matcher: hook.pattern || "",
      hooks: [
        {
          type: "command",
          command,
          ...(hook.timeout ? { timeout: hook.timeout } : {}),
        },
      ],
    };

    result[claudeEvent]!.push(matcher);

    if (!mapping.bidirectional) {
      warnings.push({
        severity: "info",
        component: "hooks",
        message: `Hook "${hook.event}" → "${claudeEvent}" is a one-way mapping; semantics may differ`,
      });
    }
  }

  return { hooks: result, warnings };
}
