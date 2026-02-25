/**
 * Marketplace-level operations for batch converting entire plugin marketplaces
 * between Claude Code and OpenCode formats.
 *
 * Supports:
 * - Converting all plugins in a marketplace
 * - Maintaining a fork of a marketplace for the target format
 * - Generating documentation, validation, and CI workflows
 * - Parallel processing with configurable concurrency
 */

import { readdir, readFile, writeFile, stat, mkdir, cp } from "fs/promises";
import { join, basename } from "path";
import { ConversionEngine } from "../converters/engine";
import type {
  ConversionDirection,
  ConversionResult,
  MarketplaceConversionConfig,
  MarketplaceConversionReport,
} from "../core/types/common";

// ── Marketplace Converter ────────────────────────────────────────────

export class MarketplaceConverter {
  private engine = new ConversionEngine();

  async convert(
    config: MarketplaceConversionConfig,
  ): Promise<MarketplaceConversionReport> {
    const startTime = Date.now();
    const plugins = await this.discoverPlugins(config);

    const results: Array<{ plugin: string; result: ConversionResult }> = [];
    let converted = 0;
    let failed = 0;
    let skipped = 0;
    let totalWarnings = 0;

    // Process plugins with concurrency control
    const concurrency = config.parallel || 4;
    const chunks = chunkArray(plugins, concurrency);

    for (const chunk of chunks) {
      const chunkResults = await Promise.allSettled(
        chunk.map(async (pluginPath) => {
          const pluginName = basename(pluginPath);
          const outputPath = join(config.targetDir, pluginName);

          try {
            await mkdir(outputPath, { recursive: true });
            const result = await this.engine.convert(
              pluginPath,
              outputPath,
              config.direction,
              "full",
            );

            if (result.success) {
              converted++;
            } else {
              failed++;
            }

            totalWarnings += result.warnings.length;
            return { plugin: pluginName, result };
          } catch (error) {
            failed++;
            const errorResult: ConversionResult = {
              success: false,
              direction: config.direction,
              mode: "full",
              outputPath,
              warnings: [
                {
                  severity: "error",
                  component: "plugin",
                  message: `Failed to convert "${pluginName}": ${error instanceof Error ? error.message : String(error)}`,
                },
              ],
              changesApplied: [],
              timestamp: new Date().toISOString(),
            };
            return { plugin: pluginName, result: errorResult };
          }
        }),
      );

      for (const settledResult of chunkResults) {
        if (settledResult.status === "fulfilled") {
          results.push(settledResult.value);
        }
      }
    }

    // Generate marketplace-level artifacts
    if (config.generateDocs) {
      await this.generateDocs(config, results);
    }

    if (config.runValidation) {
      await this.runValidation(config);
    }

    const report: MarketplaceConversionReport = {
      totalPlugins: plugins.length,
      converted,
      failed,
      skipped,
      warnings: totalWarnings,
      results,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
    };

    // Write report
    await writeFile(
      join(config.targetDir, "conversion-report.json"),
      JSON.stringify(report, null, 2) + "\n",
    );

    return report;
  }

  // ── Plugin Discovery ─────────────────────────────────────────────

  private async discoverPlugins(
    config: MarketplaceConversionConfig,
  ): Promise<string[]> {
    const plugins: string[] = [];
    const entries = await readdir(config.sourceDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const pluginPath = join(config.sourceDir, entry.name);

      // Check if this is a valid plugin
      if (await this.isValidPlugin(pluginPath, config.direction)) {
        // Apply include/exclude filters
        if (config.include && config.include.length > 0) {
          if (!config.include.some((p) => matchGlob(entry.name, p))) {
            continue;
          }
        }
        if (config.exclude && config.exclude.length > 0) {
          if (config.exclude.some((p) => matchGlob(entry.name, p))) {
            continue;
          }
        }

        plugins.push(pluginPath);
      }
    }

    return plugins;
  }

  private async isValidPlugin(
    path: string,
    direction: ConversionDirection,
  ): Promise<boolean> {
    if (direction === "claude-to-opencode") {
      // Check for Claude Code plugin markers
      const manifestPath = join(path, ".claude-plugin", "plugin.json");
      const skillsDir = join(path, "skills");
      const commandsDir = join(path, "commands");
      return (
        (await pathExists(manifestPath)) ||
        (await pathExists(skillsDir)) ||
        (await pathExists(commandsDir))
      );
    } else {
      // Check for OpenCode plugin markers
      const configPath = join(path, "opencode.json");
      const pluginsDir = join(path, ".opencode", "plugins");
      const instructionsDir = join(path, "instructions");
      return (
        (await pathExists(configPath)) ||
        (await pathExists(pluginsDir)) ||
        (await pathExists(instructionsDir))
      );
    }
  }

  // ── Documentation Generation ─────────────────────────────────────

  private async generateDocs(
    config: MarketplaceConversionConfig,
    results: Array<{ plugin: string; result: ConversionResult }>,
  ): Promise<void> {
    const isClaudeToOpenCode = config.direction === "claude-to-opencode";
    const targetName = isClaudeToOpenCode ? "OpenCode" : "Claude Code";
    const sourceName = isClaudeToOpenCode ? "Claude Code" : "OpenCode";

    // Generate README
    const readme = generateMarketplaceReadme(
      targetName,
      sourceName,
      results,
    );
    await writeFile(join(config.targetDir, "README.md"), readme);

    // Generate per-plugin conversion notes
    for (const { plugin, result } of results) {
      if (result.warnings.length > 0) {
        const notes = generateConversionNotes(plugin, result);
        await writeFile(
          join(config.targetDir, plugin, "CONVERSION_NOTES.md"),
          notes,
        );
      }
    }
  }

  // ── Validation ───────────────────────────────────────────────────

  private async runValidation(
    config: MarketplaceConversionConfig,
  ): Promise<void> {
    const entries = await readdir(config.targetDir, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const pluginPath = join(config.targetDir, entry.name);

      if (config.direction === "claude-to-opencode") {
        await this.validateOpenCodePlugin(pluginPath);
      } else {
        await this.validateClaudeCodePlugin(pluginPath);
      }
    }
  }

  private async validateClaudeCodePlugin(path: string): Promise<boolean> {
    const manifestPath = join(path, ".claude-plugin", "plugin.json");
    if (!(await pathExists(manifestPath))) return false;

    try {
      const content = await readFile(manifestPath, "utf-8");
      const manifest = JSON.parse(content);
      return typeof manifest.name === "string" && manifest.name.length > 0;
    } catch {
      return false;
    }
  }

  private async validateOpenCodePlugin(path: string): Promise<boolean> {
    const configPath = join(path, "opencode.json");
    if (!(await pathExists(configPath))) return false;

    try {
      const content = await readFile(configPath, "utf-8");
      const config = JSON.parse(content);
      return typeof config.name === "string" && config.name.length > 0;
    } catch {
      return false;
    }
  }

  // ── CI Workflow Generation ───────────────────────────────────────

  async generateCIWorkflows(
    targetDir: string,
    direction: ConversionDirection,
  ): Promise<void> {
    const workflowsDir = join(targetDir, ".github", "workflows");
    await mkdir(workflowsDir, { recursive: true });

    // Sync workflow
    await writeFile(
      join(workflowsDir, "sync.yaml"),
      generateSyncWorkflow(direction),
    );

    // Validation workflow
    await writeFile(
      join(workflowsDir, "validate.yaml"),
      generateValidationWorkflow(direction),
    );

    // Test workflow
    await writeFile(
      join(workflowsDir, "test.yaml"),
      generateTestWorkflow(direction),
    );
  }
}

// ── Helpers ──────────────────────────────────────────────────────────

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function matchGlob(name: string, pattern: string): boolean {
  // Simple glob matching (supports * and ?)
  const regex = new RegExp(
    "^" +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".") +
      "$",
  );
  return regex.test(name);
}

// ── Template Generators ──────────────────────────────────────────────

function generateMarketplaceReadme(
  targetName: string,
  sourceName: string,
  results: Array<{ plugin: string; result: ConversionResult }>,
): string {
  const successful = results.filter((r) => r.result.success);
  const failed = results.filter((r) => !r.result.success);

  return `# ${targetName} Plugin Marketplace

This marketplace was automatically converted from a ${sourceName} plugin marketplace
using [claude-utils plugin-convert](https://github.com/nsheaps/claude-utils).

## Plugins

| Plugin | Status | Warnings |
|--------|--------|----------|
${results
  .map(
    (r) =>
      `| ${r.plugin} | ${r.result.success ? "Converted" : "Failed"} | ${r.result.warnings.length} |`,
  )
  .join("\n")}

## Statistics

- **Total plugins:** ${results.length}
- **Successfully converted:** ${successful.length}
- **Failed:** ${failed.length}
- **Generated:** ${new Date().toISOString()}

## Usage

### ${targetName === "OpenCode" ? "OpenCode" : "Claude Code"} Installation

${
  targetName === "OpenCode"
    ? '```bash\n# Add to your opencode.json\n# Or place plugins in .opencode/plugins/\n```'
    : '```bash\nclaude plugin marketplace add <this-repo>\nclaude plugin install <plugin-name>@<marketplace>\n```'
}

## Keeping in Sync

This marketplace is kept in sync with the source ${sourceName} marketplace.
The sync workflow runs on every push to the source and creates a PR with changes.

## Conversion Notes

Some plugins may have conversion notes documenting manual adjustments needed.
Check each plugin's \`CONVERSION_NOTES.md\` file for details.
`;
}

function generateConversionNotes(
  plugin: string,
  result: ConversionResult,
): string {
  return `# Conversion Notes: ${plugin}

**Direction:** ${result.direction}
**Converted:** ${result.timestamp}

## Warnings

${result.warnings
  .map(
    (w) =>
      `### ${w.severity.toUpperCase()}: ${w.component}\n\n${w.message}\n\n${w.suggestion ? `**Suggestion:** ${w.suggestion}\n` : ""}`,
  )
  .join("\n")}

## Changes Applied

${result.changesApplied
  .map((c) => `- **${c.type}** (${c.component}): ${c.description}`)
  .join("\n")}
`;
}

function generateSyncWorkflow(direction: ConversionDirection): string {
  const isClaudeToOpenCode = direction === "claude-to-opencode";
  return `name: Sync from ${isClaudeToOpenCode ? "Claude Code" : "OpenCode"} Marketplace

on:
  schedule:
    - cron: '0 */6 * * *'
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install

      - name: Clone source marketplace
        run: |
          git clone \${{ secrets.SOURCE_MARKETPLACE_URL }} /tmp/source-marketplace

      - name: Run sync
        run: |
          bun run src/cli/index.ts marketplace sync \\
            --source /tmp/source-marketplace \\
            --target ./plugins \\
            --direction ${direction} \\
            --mode sync

      - name: Create PR if changes
        uses: peter-evans/create-pull-request@v6
        with:
          title: "sync: update from source marketplace"
          body: "Automated sync from source marketplace"
          branch: sync/update
          commit-message: "sync: update converted plugins"
`;
}

function generateValidationWorkflow(direction: ConversionDirection): string {
  return `name: Validate Plugins

on:
  push:
  pull_request:

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install

      - name: Validate all plugins
        run: |
          bun run src/cli/index.ts marketplace validate \\
            --dir ./plugins \\
            --direction ${direction}

      - name: Check formatting
        run: bun run fmt:check

      - name: Run tests
        run: bun test
`;
}

function generateTestWorkflow(direction: ConversionDirection): string {
  return `name: Test

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install

      - name: Type check
        run: bun run typecheck

      - name: Lint
        run: bun run lint

      - name: Test
        run: bun test

      - name: Build
        run: bun run build
`;
}
