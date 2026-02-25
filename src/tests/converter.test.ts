/**
 * Tests for the plugin conversion engine.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { ConversionEngine } from "../converters/engine";
import { parseClaudeCodePlugin } from "../parsers/claude-code-parser";
import { parseOpenCodePlugin } from "../parsers/open-code-parser";
import { convertClaudeHooksToOpenCode, convertOpenCodeHooksToClaude } from "../converters/hook-converter";
import { convertClaudeMCPToOpenCode, convertOpenCodeMCPToClaude } from "../converters/mcp-converter";
import { convertClaudeSkillsToOpenCode, convertOpenCodeSkillsToClaude } from "../converters/skill-converter";
import { validateClaudeCodePlugin, validateOpenCodePlugin, detectPluginFormat } from "../utils/validator";
import type { ClaudeCodeHooks } from "../core/types/claude-code";
import type { OpenCodeHookConfig } from "../core/types/open-code";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "plugin-convert-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ── Claude Code Plugin Fixtures ──────────────────────────────────────

async function createClaudeCodePlugin(dir: string): Promise<string> {
  const pluginDir = join(dir, "test-plugin");

  await mkdir(join(pluginDir, ".claude-plugin"), { recursive: true });
  await mkdir(join(pluginDir, "skills", "my-skill"), { recursive: true });
  await mkdir(join(pluginDir, "commands"), { recursive: true });
  await mkdir(join(pluginDir, "agents"), { recursive: true });
  await mkdir(join(pluginDir, "hooks"), { recursive: true });

  await writeFile(
    join(pluginDir, ".claude-plugin", "plugin.json"),
    JSON.stringify(
      {
        name: "test-plugin",
        version: "1.0.0",
        description: "A test plugin",
        author: { name: "Test Author" },
      },
      null,
      2,
    ),
  );

  await writeFile(
    join(pluginDir, "skills", "my-skill", "SKILL.md"),
    "# My Skill\n\nThis is a test skill.\n",
  );

  await writeFile(
    join(pluginDir, "commands", "greet.md"),
    "---\nname: greet\ndescription: Greet the user\n---\n\n# Greet\n\nSay hello!\n",
  );

  await writeFile(
    join(pluginDir, "agents", "reviewer.md"),
    "# Code Reviewer\n\nYou are a code reviewer.\n",
  );

  await writeFile(
    join(pluginDir, "hooks", "hooks.json"),
    JSON.stringify(
      {
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash",
              hooks: [{ type: "command", command: "echo pre-tool" }],
            },
          ],
          PostToolUse: [
            {
              matcher: "",
              hooks: [{ type: "command", command: "echo post-tool" }],
            },
          ],
        },
      },
      null,
      2,
    ),
  );

  await writeFile(
    join(pluginDir, ".mcp.json"),
    JSON.stringify(
      {
        mcpServers: {
          filesystem: {
            command: "uvx",
            args: ["mcp-server-filesystem", "/home/user"],
          },
        },
      },
      null,
      2,
    ),
  );

  return pluginDir;
}

// ── OpenCode Plugin Fixtures ─────────────────────────────────────────

async function createOpenCodePlugin(dir: string): Promise<string> {
  const pluginDir = join(dir, "test-plugin-oc");

  await mkdir(join(pluginDir, ".opencode", "plugins"), { recursive: true });
  await mkdir(join(pluginDir, ".opencode", "agents"), { recursive: true });
  await mkdir(join(pluginDir, "instructions", "my-instruction"), { recursive: true });
  await mkdir(join(pluginDir, "commands"), { recursive: true });

  await writeFile(
    join(pluginDir, "opencode.json"),
    JSON.stringify(
      {
        name: "test-plugin-oc",
        version: "1.0.0",
        description: "An OpenCode test plugin",
        hooks: [
          { event: "beforeTool", pattern: "Bash", command: "echo before-tool" },
          { event: "afterTool", command: "echo after-tool" },
        ],
        mcpServers: {
          filesystem: {
            command: "uvx",
            args: ["mcp-server-filesystem", "/home/user"],
            transport: "stdio",
          },
        },
      },
      null,
      2,
    ),
  );

  await writeFile(
    join(pluginDir, "instructions", "my-instruction", "README.md"),
    "# My Instruction\n\nThis is a test instruction.\n",
  );

  await writeFile(
    join(pluginDir, ".opencode", "agents", "reviewer.md"),
    "# Code Reviewer\n\nYou are a code reviewer.\n",
  );

  return pluginDir;
}

// ── Parser Tests ─────────────────────────────────────────────────────

describe("Claude Code Parser", () => {
  test("parses a complete plugin", async () => {
    const pluginDir = await createClaudeCodePlugin(tempDir);
    const plugin = await parseClaudeCodePlugin(pluginDir);

    expect(plugin.manifest.name).toBe("test-plugin");
    expect(plugin.manifest.version).toBe("1.0.0");
    expect(plugin.skills).toHaveLength(1);
    expect(plugin.skills[0].name).toBe("my-skill");
    expect(plugin.commands).toHaveLength(1);
    expect(plugin.agents).toHaveLength(1);
    expect(plugin.hooks.PreToolUse).toBeDefined();
    expect(plugin.hooks.PostToolUse).toBeDefined();
    expect(plugin.mcpServers.filesystem).toBeDefined();
  });

  test("handles missing manifest gracefully", async () => {
    const pluginDir = join(tempDir, "no-manifest");
    await mkdir(join(pluginDir, "skills", "test"), { recursive: true });
    await writeFile(join(pluginDir, "skills", "test", "SKILL.md"), "# Test\n");

    const plugin = await parseClaudeCodePlugin(pluginDir);
    expect(plugin.manifest.name).toBe("no-manifest");
    expect(plugin.skills).toHaveLength(1);
  });
});

describe("OpenCode Parser", () => {
  test("parses a complete plugin", async () => {
    const pluginDir = await createOpenCodePlugin(tempDir);
    const plugin = await parseOpenCodePlugin(pluginDir);

    expect(plugin.config.name).toBe("test-plugin-oc");
    expect(plugin.config.version).toBe("1.0.0");
    expect(plugin.instructions).toHaveLength(1);
    expect(plugin.hooks).toHaveLength(2);
    expect(plugin.mcpServers.filesystem).toBeDefined();
    expect(plugin.agents.reviewer).toBeDefined();
  });
});

// ── Hook Converter Tests ─────────────────────────────────────────────

describe("Hook Converter", () => {
  test("converts Claude Code hooks to OpenCode", () => {
    const hooks: ClaudeCodeHooks = {
      PreToolUse: [
        {
          matcher: "Bash|Write",
          hooks: [{ type: "command", command: "echo check" }],
        },
      ],
      SessionStart: [
        {
          matcher: "",
          hooks: [{ type: "command", command: "echo init" }],
        },
      ],
    };

    const { hooks: converted, warnings } = convertClaudeHooksToOpenCode(hooks);

    expect(converted).toHaveLength(2);
    expect(converted[0].event).toBe("beforeTool");
    expect(converted[0].pattern).toBe("Bash|Write");
    expect(converted[0].command).toBe("echo check");
    expect(converted[1].event).toBe("sessionStart");
  });

  test("converts OpenCode hooks to Claude Code", () => {
    const hooks: OpenCodeHookConfig[] = [
      { event: "beforeTool", pattern: "Bash", command: "echo before" },
      { event: "afterTool", command: "echo after" },
    ];

    const { hooks: converted, warnings } = convertOpenCodeHooksToClaude(hooks);

    expect(converted.PreToolUse).toBeDefined();
    expect(converted.PreToolUse).toHaveLength(1);
    expect(converted.PostToolUse).toBeDefined();
    expect(converted.PostToolUse).toHaveLength(1);
  });

  test("warns on unmappable events", () => {
    const hooks: ClaudeCodeHooks = {
      Stop: [{ matcher: "", hooks: [{ type: "command", command: "echo stop" }] }],
    };

    const { warnings } = convertClaudeHooksToOpenCode(hooks);
    const infoWarnings = warnings.filter((w) => w.severity === "info");
    expect(infoWarnings.length).toBeGreaterThan(0);
  });
});

// ── MCP Converter Tests ──────────────────────────────────────────────

describe("MCP Converter", () => {
  test("converts Claude Code MCP to OpenCode", () => {
    const servers = {
      myserver: {
        command: "uvx",
        args: ["mcp-server-test"],
        env: { KEY: "value" },
      },
    };

    const { servers: converted } = convertClaudeMCPToOpenCode(servers);

    expect(converted.myserver).toBeDefined();
    expect(converted.myserver.command).toBe("uvx");
    expect(converted.myserver.transport).toBe("stdio");
  });

  test("handles CLAUDE_PLUGIN_ROOT substitution", () => {
    const servers = {
      custom: {
        command: "${CLAUDE_PLUGIN_ROOT}/bin/server",
        args: ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"],
      },
    };

    const { servers: converted, warnings } = convertClaudeMCPToOpenCode(servers);

    expect(converted.custom.command).toContain("OPENCODE_PLUGIN_ROOT");
    expect(converted.custom.args![1]).toContain("OPENCODE_PLUGIN_ROOT");
  });

  test("converts OpenCode MCP to Claude Code", () => {
    const servers = {
      myserver: {
        command: "uvx",
        args: ["mcp-server-test"],
        transport: "stdio" as const,
      },
    };

    const { servers: converted } = convertOpenCodeMCPToClaude(servers);

    expect(converted.myserver).toBeDefined();
    expect(converted.myserver.command).toBe("uvx");
    expect((converted.myserver as any).transport).toBeUndefined();
  });

  test("warns on non-stdio transport", () => {
    const servers = {
      remote: {
        command: "remote-server",
        transport: "http" as const,
        url: "https://example.com/mcp",
      },
    };

    const { warnings } = convertOpenCodeMCPToClaude(servers);
    expect(warnings.some((w) => w.severity === "warning")).toBe(true);
  });
});

// ── Skill Converter Tests ────────────────────────────────────────────

describe("Skill Converter", () => {
  test("converts Claude Code skills to OpenCode instructions", () => {
    const skills = [
      {
        name: "my-skill",
        path: "skills/my-skill/SKILL.md",
        content: "# My Skill\n\nDoes things.\n",
        references: [],
      },
    ];

    const { instructions } = convertClaudeSkillsToOpenCode(skills);

    expect(instructions).toHaveLength(1);
    expect(instructions[0].name).toBe("my-skill");
    expect(instructions[0].content).toContain("My Skill");
  });

  test("converts OpenCode instructions to Claude Code skills", () => {
    const instructions = [
      {
        name: "my-instruction",
        path: "instructions/my-instruction/README.md",
        content: "# My Instruction\n\nDoes things.\n",
      },
    ];

    const { skills } = convertOpenCodeSkillsToClaude(instructions);

    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("my-instruction");
    expect(skills[0].content).toContain("My Instruction");
  });
});

// ── Conversion Engine Tests ──────────────────────────────────────────

describe("Conversion Engine", () => {
  test("full conversion Claude Code → OpenCode", async () => {
    const pluginDir = await createClaudeCodePlugin(tempDir);
    const outputDir = join(tempDir, "output-oc");

    const engine = new ConversionEngine();
    const result = await engine.convert(
      pluginDir,
      outputDir,
      "claude-to-opencode",
      "full",
    );

    expect(result.success).toBe(true);
    expect(result.direction).toBe("claude-to-opencode");

    // Verify output structure
    const config = JSON.parse(
      await readFile(join(outputDir, "opencode.json"), "utf-8"),
    );
    expect(config.name).toBe("test-plugin");
  });

  test("full conversion OpenCode → Claude Code", async () => {
    const pluginDir = await createOpenCodePlugin(tempDir);
    const outputDir = join(tempDir, "output-cc");

    const engine = new ConversionEngine();
    const result = await engine.convert(
      pluginDir,
      outputDir,
      "opencode-to-claude",
      "full",
    );

    expect(result.success).toBe(true);
    expect(result.direction).toBe("opencode-to-claude");

    // Verify output structure
    const manifest = JSON.parse(
      await readFile(
        join(outputDir, ".claude-plugin", "plugin.json"),
        "utf-8",
      ),
    );
    expect(manifest.name).toBe("test-plugin-oc");
  });

  test("diff mode does not write files", async () => {
    const pluginDir = await createClaudeCodePlugin(tempDir);
    const outputDir = join(tempDir, "output-diff");

    const engine = new ConversionEngine();
    const result = await engine.convert(
      pluginDir,
      outputDir,
      "claude-to-opencode",
      "diff",
    );

    expect(result.success).toBe(true);
    expect(result.changesApplied.length).toBeGreaterThan(0);

    // Output directory should not exist (diff doesn't write)
    const { stat: statAsync } = await import("fs/promises");
    let outputExists = true;
    try {
      await statAsync(join(outputDir, "opencode.json"));
    } catch {
      outputExists = false;
    }
    expect(outputExists).toBe(false);
  });

  test("sync mode falls back to full when no state exists", async () => {
    const pluginDir = await createClaudeCodePlugin(tempDir);
    const outputDir = join(tempDir, "output-sync");

    const engine = new ConversionEngine();
    const result = await engine.convert(
      pluginDir,
      outputDir,
      "claude-to-opencode",
      "sync",
    );

    expect(result.success).toBe(true);
    // Should have a warning about no previous sync state
    expect(result.warnings.some((w) => w.message.includes("No previous sync state"))).toBe(true);
  });
});

// ── Validator Tests ──────────────────────────────────────────────────

describe("Validator", () => {
  test("validates a valid Claude Code plugin", async () => {
    const pluginDir = await createClaudeCodePlugin(tempDir);
    const result = await validateClaudeCodePlugin(pluginDir);
    expect(result.valid).toBe(true);
  });

  test("validates a valid OpenCode plugin", async () => {
    const pluginDir = await createOpenCodePlugin(tempDir);
    const result = await validateOpenCodePlugin(pluginDir);
    expect(result.valid).toBe(true);
  });

  test("detects Claude Code format", async () => {
    const pluginDir = await createClaudeCodePlugin(tempDir);
    const format = await detectPluginFormat(pluginDir);
    expect(format).toBe("claude-code");
  });

  test("detects OpenCode format", async () => {
    const pluginDir = await createOpenCodePlugin(tempDir);
    const format = await detectPluginFormat(pluginDir);
    expect(format).toBe("opencode");
  });

  test("returns unknown for empty directory", async () => {
    const emptyDir = join(tempDir, "empty");
    await mkdir(emptyDir);
    const format = await detectPluginFormat(emptyDir);
    expect(format).toBe("unknown");
  });
});
