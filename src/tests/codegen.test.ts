/**
 * Tests for the AST/template-based codegen strategy.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, mkdir, writeFile, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import ts from "typescript";
import { CodegenConverter } from "../codegen/codegen-strategy";
import { generateHooksPluginAST } from "../codegen/hooks-generator";
import { generateCommandAST, generateCommandMarkdown } from "../codegen/commands-generator";
import {
  generateOpenCodeConfig,
  generateClaudeManifest,
  generateHooksConfig,
} from "../codegen/config-generator";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "codegen-ast-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ── Helpers ──────────────────────────────────────────────────────────

async function createClaudeCodePlugin(dir: string): Promise<string> {
  const pluginDir = join(dir, "test-plugin");

  await mkdir(join(pluginDir, ".claude-plugin"), { recursive: true });
  await mkdir(join(pluginDir, "skills", "my-skill"), { recursive: true });
  await mkdir(join(pluginDir, "commands"), { recursive: true });
  await mkdir(join(pluginDir, "hooks"), { recursive: true });
  await mkdir(join(pluginDir, "agents"), { recursive: true });

  await writeFile(
    join(pluginDir, ".claude-plugin", "plugin.json"),
    JSON.stringify({
      name: "test-plugin",
      version: "1.0.0",
      description: "A test plugin",
    }, null, 2),
  );

  await writeFile(
    join(pluginDir, "skills", "my-skill", "SKILL.md"),
    "# My Skill\n\nTest skill content.\n",
  );

  await writeFile(
    join(pluginDir, "commands", "greet.md"),
    "---\nname: greet\ndescription: Say hello\n---\n\n# Greet\n\nGreet the user.\n",
  );

  await writeFile(
    join(pluginDir, "hooks", "hooks.json"),
    JSON.stringify({
      hooks: {
        PreToolUse: [
          { matcher: "Bash", hooks: [{ type: "command", command: "echo pre" }] },
        ],
        PostToolUse: [
          { matcher: "", hooks: [{ type: "command", command: "echo post" }] },
        ],
      },
    }, null, 2),
  );

  await writeFile(
    join(pluginDir, "agents", "helper.md"),
    "# Helper Agent\n\nYou are a helpful assistant.\n",
  );

  return pluginDir;
}

async function createOpenCodePlugin(dir: string): Promise<string> {
  const pluginDir = join(dir, "oc-plugin");

  await mkdir(join(pluginDir, "instructions", "guide"), { recursive: true });
  await mkdir(join(pluginDir, "commands"), { recursive: true });

  await writeFile(
    join(pluginDir, "opencode.json"),
    JSON.stringify({
      name: "oc-plugin",
      version: "2.0.0",
      description: "An OpenCode plugin",
    }, null, 2),
  );

  await writeFile(
    join(pluginDir, "instructions", "guide", "README.md"),
    "# Guide\n\nGuide content.\n",
  );

  return pluginDir;
}

function isValidTypeScript(source: string): boolean {
  const sourceFile = ts.createSourceFile(
    "test.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  // Check for parse diagnostics
  const diagnostics = (sourceFile as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics;
  return !diagnostics || diagnostics.length === 0;
}

// ── Hooks Generator Tests ────────────────────────────────────────────

describe("Hooks Generator (AST)", () => {
  test("generates valid TypeScript for shell command hooks", () => {
    const hooks = [
      { event: "beforeTool" as const, command: "echo before" },
      { event: "afterTool" as const, command: "echo after" },
    ];

    const result = generateHooksPluginAST(hooks);

    expect(result).toContain("PluginContext");
    expect(result).toContain("HooksPlugin");
    expect(result).toContain("tool.execute.before");
    expect(result).toContain("tool.execute.after");
    expect(result).toContain("execSync");
    expect(result).toContain("OPENCODE_EVENT");
    expect(isValidTypeScript(result)).toBe(true);
  });

  test("generates valid TypeScript for dynamic import hooks", () => {
    const hooks = [
      { event: "sessionStart" as const, handler: "./handlers/start.ts" },
    ];

    const result = generateHooksPluginAST(hooks);

    expect(result).toContain("session.created");
    expect(result).toContain("./handlers/start.ts");
    expect(result).toContain("handler.default");
    expect(isValidTypeScript(result)).toBe(true);
  });

  test("generates export default", () => {
    const hooks = [{ event: "beforeTool" as const, command: "echo x" }];
    const result = generateHooksPluginAST(hooks);

    expect(result).toContain("export default HooksPlugin");
  });

  test("handles empty hooks array", () => {
    const result = generateHooksPluginAST([]);
    expect(result).toContain("HooksPlugin");
    expect(result).toContain("return {}");
    expect(isValidTypeScript(result)).toBe(true);
  });
});

// ── Commands Generator Tests ─────────────────────────────────────────

describe("Commands Generator (AST)", () => {
  test("generates valid TypeScript command stub", () => {
    const cmd = {
      name: "deploy",
      description: "Deploy the application",
      handler: "commands/deploy.ts",
    };

    const result = generateCommandAST(cmd);

    expect(result).toContain('"deploy"');
    expect(result).toContain('"Deploy the application"');
    expect(result).toContain("handler");
    expect(result).toContain("Record<string, unknown>");
    expect(isValidTypeScript(result)).toBe(true);
  });

  test("includes aliases when present", () => {
    const cmd = {
      name: "build",
      aliases: ["b", "compile"],
      description: "Build the project",
      handler: "commands/build.ts",
    };

    const result = generateCommandAST(cmd);

    expect(result).toContain("aliases");
    expect(result).toContain('"b"');
    expect(result).toContain('"compile"');
  });

  test("includes parameters when present", () => {
    const cmd = {
      name: "test",
      description: "Run tests",
      handler: "commands/test.ts",
      parameters: [
        { name: "pattern", type: "string", description: "Test pattern", required: false },
      ],
    };

    const result = generateCommandAST(cmd);

    expect(result).toContain("parameters");
    expect(result).toContain('"pattern"');
    expect(result).toContain('"Test pattern"');
  });

  test("generates markdown command with frontmatter", () => {
    const cmd = {
      name: "greet",
      description: "Say hello",
      content: "# Greet\n\nGreet the user.",
      path: "commands/greet.md",
    };

    const result = generateCommandMarkdown(cmd);

    expect(result).toContain("---");
    expect(result).toContain("name: greet");
    expect(result).toContain("description: Say hello");
    expect(result).toContain("# Greet");
  });
});

// ── Config Generator Tests ───────────────────────────────────────────

describe("Config Generators", () => {
  test("generates valid opencode.json", () => {
    const plugin = {
      config: {
        name: "test",
        version: "1.0.0",
        description: "Test plugin",
      },
      instructions: [],
      commands: [{ name: "greet", description: "Greet", handler: "commands/greet.ts" }],
      hooks: [],
      mcpServers: {},
      agents: {},
      rootPath: "/tmp",
    };

    const result = generateOpenCodeConfig(plugin);
    const parsed = JSON.parse(result);

    expect(parsed.name).toBe("test");
    expect(parsed.version).toBe("1.0.0");
    expect(parsed.commands).toHaveLength(1);
    expect(parsed.commands[0].name).toBe("greet");
  });

  test("generates valid plugin.json manifest", () => {
    const plugin = {
      manifest: { name: "my-plugin", version: "2.0.0", description: "My plugin" },
      skills: [],
      commands: [],
      agents: [],
      hooks: {},
      mcpServers: {},
      rootPath: "/tmp",
    };

    const result = generateClaudeManifest(plugin);
    const parsed = JSON.parse(result);

    expect(parsed.name).toBe("my-plugin");
    expect(parsed.version).toBe("2.0.0");
  });

  test("generates valid hooks.json", () => {
    const hooks = {
      PreToolUse: [
        { matcher: "Bash", hooks: [{ type: "command" as const, command: "echo pre" }] },
      ],
    };

    const result = generateHooksConfig(hooks);
    const parsed = JSON.parse(result);

    expect(parsed.hooks.PreToolUse).toHaveLength(1);
    expect(parsed.hooks.PreToolUse[0].matcher).toBe("Bash");
  });
});

// ── End-to-End Codegen Strategy Tests ────────────────────────────────

describe("CodegenConverter End-to-End", () => {
  test("converts Claude Code → OpenCode with codegen", async () => {
    const pluginDir = await createClaudeCodePlugin(tempDir);
    const outputDir = join(tempDir, "output");

    const converter = new CodegenConverter();
    const result = await converter.convert({
      direction: "claude-to-opencode",
      sourcePath: pluginDir,
      outputPath: outputDir,
    });

    expect(result.strategy).toBe("codegen");
    expect(result.filesGenerated).toBeGreaterThan(0);
    expect(result.conversions.length).toBeGreaterThan(0);

    // Verify generated files exist and are valid
    const configContent = await readFile(join(outputDir, "opencode.json"), "utf-8");
    const config = JSON.parse(configContent);
    expect(config.name).toBe("test-plugin");

    // Verify hooks TypeScript is syntactically valid
    const hooksContent = await readFile(
      join(outputDir, ".opencode", "plugins", "hooks.ts"),
      "utf-8",
    );
    expect(isValidTypeScript(hooksContent)).toBe(true);
    expect(hooksContent).toContain("tool.execute.before");

    // Verify command stub
    const cmdContent = await readFile(join(outputDir, "commands", "greet.ts"), "utf-8");
    expect(isValidTypeScript(cmdContent)).toBe(true);
    expect(cmdContent).toContain('"greet"');
  });

  test("converts OpenCode → Claude Code with codegen", async () => {
    const pluginDir = await createOpenCodePlugin(tempDir);
    const outputDir = join(tempDir, "output");

    const converter = new CodegenConverter();
    const result = await converter.convert({
      direction: "opencode-to-claude",
      sourcePath: pluginDir,
      outputPath: outputDir,
    });

    expect(result.strategy).toBe("codegen");
    expect(result.filesGenerated).toBeGreaterThan(0);

    // Verify manifest
    const manifestContent = await readFile(
      join(outputDir, ".claude-plugin", "plugin.json"),
      "utf-8",
    );
    const manifest = JSON.parse(manifestContent);
    expect(manifest.name).toBe("oc-plugin");
  });

  test("works with no API keys (completely free)", async () => {
    const pluginDir = await createClaudeCodePlugin(tempDir);
    const outputDir = join(tempDir, "output");

    // Remove API key from env
    const origKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const converter = new CodegenConverter();
      const result = await converter.convert({
        direction: "claude-to-opencode",
        sourcePath: pluginDir,
        outputPath: outputDir,
      });

      // Should succeed without any API key
      expect(result.strategy).toBe("codegen");
      expect(result.filesGenerated).toBeGreaterThan(0);
      expect(result.warnings.every((w) => !w.message.includes("API key"))).toBe(true);
    } finally {
      if (origKey) process.env.ANTHROPIC_API_KEY = origKey;
    }
  });

  test("handles specific component selection", async () => {
    const pluginDir = await createClaudeCodePlugin(tempDir);
    const outputDir = join(tempDir, "output");

    const converter = new CodegenConverter();
    const result = await converter.convert({
      direction: "claude-to-opencode",
      sourcePath: pluginDir,
      outputPath: outputDir,
      components: ["hooks"],
    });

    expect(result.conversions.length).toBe(1);
    expect(result.conversions[0].component).toBe("hooks");
  });
});
