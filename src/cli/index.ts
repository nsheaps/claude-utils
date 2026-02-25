#!/usr/bin/env bun
/**
 * plugin-convert CLI - Convert plugins between Claude Code and OpenCode formats.
 *
 * Usage:
 *   plugin-convert convert [options]     Convert a single plugin
 *   plugin-convert sync [options]        Sync changes incrementally
 *   plugin-convert diff [options]        Preview conversion changes
 *   plugin-convert validate [options]    Validate a plugin structure
 *   plugin-convert marketplace [cmd]     Marketplace-level operations
 *   plugin-convert detect [path]         Detect plugin format
 *
 * AI-Powered Conversion Strategies:
 *   --agentic        Use agentic SDK (multi-turn agent loop)
 *   --oneshot        Use one-shot (single API call, faster/cheaper)
 *   --free           Use free models via OpenRouter (no cost)
 *   --strategy       Explicit strategy: claude | opencode | oneshot | free | auto
 */

import { resolve } from "path";
import { ConversionEngine } from "../converters/engine";
import { AgenticConverter } from "../agents/agentic-converter";
import type { ConversionStrategy } from "../agents/agentic-converter";
import { MarketplaceConverter } from "../marketplace/marketplace-converter";
import { validatePlugin, detectPluginFormat } from "../utils/validator";
import { logger, setLogLevel, setJsonOutput } from "../utils/logger";
import { ensureApiKey } from "../config/api-key-wizard";
import { runFullSetup } from "../config/api-key-wizard";
import type { ConversionDirection, ConversionMode } from "../core/types/common";

const VERSION = "0.1.0";

// ── Argument Parsing ─────────────────────────────────────────────────

interface ParsedArgs {
  command: string;
  subcommand?: string;
  source?: string;
  target?: string;
  direction?: string;
  agentic?: boolean;
  oneshot?: boolean;
  codegen?: boolean;
  free?: boolean;
  strategy?: string;
  sdk?: string; // legacy alias for --strategy
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  budget?: number;
  json?: boolean;
  verbose?: boolean;
  help?: boolean;
  version?: boolean;
  parallel?: number;
  generateDocs?: boolean;
  runValidation?: boolean;
  include?: string[];
  exclude?: string[];
  dir?: string;
}

function parseArgs(args: string[]): ParsedArgs {
  const parsed: ParsedArgs = { command: "" };
  let i = 0;

  // First positional argument is the command
  while (i < args.length && args[i].startsWith("-")) i++;
  if (i < args.length) {
    parsed.command = args[i];
    i++;
  }

  // Second positional argument may be subcommand
  const nextPos = args.findIndex((a, idx) => idx > i - 1 && !a.startsWith("-"));
  if (nextPos >= 0 && parsed.command === "marketplace") {
    parsed.subcommand = args[nextPos];
  }

  // Parse flags
  for (let j = 0; j < args.length; j++) {
    const arg = args[j];
    switch (arg) {
      case "--source":
      case "-s":
        parsed.source = args[++j];
        break;
      case "--target":
      case "-t":
        parsed.target = args[++j];
        break;
      case "--direction":
      case "-d":
        parsed.direction = args[++j];
        break;
      case "--dir":
        parsed.dir = args[++j];
        break;
      case "--agentic":
        parsed.agentic = true;
        break;
      case "--oneshot":
        parsed.oneshot = true;
        break;
      case "--codegen":
        parsed.codegen = true;
        break;
      case "--free":
        parsed.free = true;
        break;
      case "--strategy":
        parsed.strategy = args[++j];
        break;
      case "--sdk":
        // Legacy alias — map to strategy
        parsed.sdk = args[++j];
        break;
      case "--api-key":
        parsed.apiKey = args[++j];
        break;
      case "--model":
        parsed.model = args[++j];
        break;
      case "--base-url":
        parsed.baseUrl = args[++j];
        break;
      case "--budget":
        parsed.budget = parseFloat(args[++j]);
        break;
      case "--json":
        parsed.json = true;
        break;
      case "--verbose":
      case "-v":
        parsed.verbose = true;
        break;
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      case "--version":
        parsed.version = true;
        break;
      case "--parallel":
        parsed.parallel = parseInt(args[++j]);
        break;
      case "--generate-docs":
        parsed.generateDocs = true;
        break;
      case "--run-validation":
        parsed.runValidation = true;
        break;
      case "--include":
        parsed.include = (parsed.include || []).concat(args[++j]);
        break;
      case "--exclude":
        parsed.exclude = (parsed.exclude || []).concat(args[++j]);
        break;
    }
  }

  return parsed;
}

// ── Help Text ────────────────────────────────────────────────────────

function showHelp(): void {
  console.log(`plugin-convert v${VERSION}
Convert plugins between Claude Code and OpenCode formats.

USAGE:
  plugin-convert <command> [options]

COMMANDS:
  convert        Convert a single plugin (full conversion)
  sync           Incrementally sync changes from source to target
  diff           Preview what changes would be applied
  validate       Validate a plugin's structure
  detect         Detect the format of a plugin directory
  marketplace    Marketplace-level operations
  setup          Configure API keys (interactive wizard)

MARKETPLACE SUBCOMMANDS:
  marketplace convert    Convert an entire marketplace
  marketplace sync       Sync marketplace incrementally
  marketplace validate   Validate all plugins in a marketplace
  marketplace init-ci    Generate CI workflows for a marketplace fork

OPTIONS:
  --source, -s <path>      Source plugin or marketplace directory
  --target, -t <path>      Target output directory
  --direction, -d <dir>    Conversion direction:
                             claude-to-opencode  (Claude Code → OpenCode)
                             opencode-to-claude  (OpenCode → Claude Code)
                             auto                (auto-detect source format)
  --dir <path>             Directory for validate/detect commands

CONVERSION STRATEGIES:
  Five strategies for converting complex components:

  1. Codegen (AST/Template) — Programmatic code generation via TypeScript AST
     Best for: Free, deterministic, no API keys needed
     Flag: --codegen

  2. Free (OpenRouter) — AI conversion using free models via OpenRouter
     Best for: Smarter conversion at no cost
     Flag: --free
     Requires: OPENROUTER_API_KEY (will prompt to set up if missing)

  3. One-Shot (Anthropic Messages API) — Single API call code generation
     Best for: Highest-quality AI conversion, CI pipelines
     Flag: --oneshot
     Requires: ANTHROPIC_API_KEY env var or --api-key flag

  4. Agentic (Claude Agent SDK) — Multi-turn agent with tool use
     Best for: OpenCode → Claude Code (uses target platform SDK)
     Flag: --agentic --strategy claude

  5. Agentic (OpenCode SDK) — Multi-turn agent via OpenCode
     Best for: Claude Code → OpenCode (uses target platform SDK)
     Flag: --agentic --strategy opencode

  --codegen                Use AST-based codegen (free, no API key)
  --free                   Use free AI models via OpenRouter (no cost)
  --oneshot                Use one-shot AI (single API call)
  --agentic                Use agentic SDK (multi-turn)
  --strategy <s>           Strategy: codegen | free | oneshot | claude | opencode | auto
  --api-key <key>          API key (Anthropic or OpenRouter, based on strategy)
  --model <model>          Model for AI strategies (default varies by strategy)
  --base-url <url>         Base URL for API (auto-set for --free)
  --budget <usd>           Max budget for agentic conversion (default: 0.50)

OTHER OPTIONS:
  --parallel <n>           Max parallel conversions for marketplace (default: 4)
  --generate-docs          Generate documentation for marketplace conversion
  --run-validation         Run validation after marketplace conversion
  --include <pattern>      Include plugins matching pattern (marketplace)
  --exclude <pattern>      Exclude plugins matching pattern (marketplace)
  --json                   Output results as JSON
  --verbose, -v            Verbose output
  --help, -h               Show this help
  --version                Show version

EXAMPLES:
  # Convert a Claude Code plugin to OpenCode (rule-based)
  plugin-convert convert -s ./my-plugin -t ./my-plugin-opencode -d claude-to-opencode

  # Convert with AST codegen (free, no API key)
  plugin-convert convert -s ./my-plugin -t ./my-plugin-opencode --codegen

  # Convert with free AI models (no cost, uses OpenRouter)
  plugin-convert convert -s ./my-plugin -t ./my-plugin-opencode --free

  # Convert with one-shot AI for highest quality
  plugin-convert convert -s ./my-plugin -t ./my-plugin-opencode --oneshot

  # Convert with agentic SDK for maximum quality
  plugin-convert convert -s ./my-plugin -t ./my-plugin-opencode --agentic

  # One-shot with explicit model and API key
  plugin-convert convert -s ./my-plugin -t ./out --oneshot \\
    --api-key sk-ant-... --model claude-sonnet-4-20250514

  # Set up API keys interactively
  plugin-convert setup

  # Sync changes incrementally
  plugin-convert sync -s ./my-plugin -t ./my-plugin-opencode -d auto

  # Convert entire marketplace with codegen
  plugin-convert marketplace convert \\
    -s ./claude-marketplace -t ./opencode-marketplace \\
    -d claude-to-opencode --codegen --generate-docs
`);
}

// ── Strategy Resolution ──────────────────────────────────────────────

function resolveStrategy(args: ParsedArgs): ConversionStrategy {
  // Explicit --strategy flag takes priority
  if (args.strategy) {
    const valid: ConversionStrategy[] = ["claude", "opencode", "oneshot", "codegen", "free", "auto"];
    if (valid.includes(args.strategy as ConversionStrategy)) {
      return args.strategy as ConversionStrategy;
    }
    logger.warn(`Unknown strategy "${args.strategy}"; using auto`);
    return "auto";
  }

  // --codegen flag
  if (args.codegen) return "codegen";

  // --free flag
  if (args.free) return "free";

  // --oneshot flag
  if (args.oneshot) return "oneshot";

  // --sdk flag (legacy)
  if (args.sdk) return args.sdk as ConversionStrategy;

  return "auto";
}

// ── Command Handlers ─────────────────────────────────────────────────

async function resolveDirection(
  direction: string | undefined,
  sourcePath: string,
): Promise<ConversionDirection> {
  if (direction === "claude-to-opencode" || direction === "opencode-to-claude") {
    return direction;
  }

  // Auto-detect
  const format = await detectPluginFormat(sourcePath);
  if (format === "claude-code") return "claude-to-opencode";
  if (format === "opencode") return "opencode-to-claude";

  logger.error("Cannot auto-detect plugin format. Specify --direction explicitly.");
  process.exit(1);
}

async function handleConvert(args: ParsedArgs): Promise<void> {
  if (!args.source) {
    logger.error("--source is required for convert command");
    process.exit(1);
  }
  if (!args.target) {
    logger.error("--target is required for convert command");
    process.exit(1);
  }

  const source = resolve(args.source);
  const target = resolve(args.target);
  const direction = await resolveDirection(args.direction, source);

  logger.info(`Converting plugin: ${direction}`, { source, target });

  const engine = new ConversionEngine();
  const result = await engine.convert(source, target, direction, "full");

  // Run enhanced conversion if enabled
  if (args.agentic || args.oneshot || args.codegen || args.free || args.strategy) {
    const strategy = resolveStrategy(args);
    const strategyLabel =
      strategy === "codegen"
        ? "codegen (AST)"
        : strategy === "free"
          ? "free (OpenRouter)"
          : strategy === "oneshot"
            ? "one-shot"
            : strategy === "auto"
              ? "auto-select"
              : `agentic (${strategy})`;
    logger.info(`Running AI conversion: ${strategyLabel}...`);

    // Ensure API key is available for strategies that need one
    let apiKey = args.apiKey;
    if (!apiKey && strategy === "free") {
      apiKey = await ensureApiKey("openrouter") || undefined;
      if (!apiKey) {
        logger.warn("No OpenRouter API key; falling back to codegen.");
      }
    } else if (!apiKey && strategy === "oneshot") {
      apiKey = await ensureApiKey("anthropic") || undefined;
      if (!apiKey) {
        logger.warn("No Anthropic API key; falling back to codegen.");
      }
    }

    const converter = new AgenticConverter();
    const aiResult = await converter.convert({
      direction,
      sourcePath: source,
      outputPath: target,
      maxBudgetUsd: args.budget,
      enabled: true,
      preferredStrategy: strategy,
      apiKey,
      model: args.model,
      baseUrl: args.baseUrl,
    });

    result.warnings.push(...aiResult.warnings);
    result.changesApplied.push(...aiResult.changes);

    if (aiResult.tokenUsage) {
      logger.info("Token usage", {
        input: String(aiResult.tokenUsage.input),
        output: String(aiResult.tokenUsage.output),
      });
    }
  }

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    logger.result("Conversion complete", {
      success: result.success ? 1 : 0,
      failed: result.success ? 0 : 1,
      warnings: result.warnings.length,
    });
    logger.changes(result.changesApplied);
    logger.warnings(result.warnings);
  }

  process.exit(result.success ? 0 : 1);
}

async function handleSync(args: ParsedArgs): Promise<void> {
  if (!args.source || !args.target) {
    logger.error("--source and --target are required for sync command");
    process.exit(1);
  }

  const source = resolve(args.source);
  const target = resolve(args.target);
  const direction = await resolveDirection(args.direction, source);

  logger.info(`Syncing plugin: ${direction}`, { source, target });

  const engine = new ConversionEngine();
  const result = await engine.convert(source, target, direction, "sync");

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    logger.result("Sync complete", {
      success: result.success ? 1 : 0,
      failed: result.success ? 0 : 1,
      warnings: result.warnings.length,
    });
    logger.changes(result.changesApplied);
    logger.warnings(result.warnings);
  }
}

async function handleDiff(args: ParsedArgs): Promise<void> {
  if (!args.source) {
    logger.error("--source is required for diff command");
    process.exit(1);
  }

  const source = resolve(args.source);
  const target = args.target ? resolve(args.target) : source + "-converted";
  const direction = await resolveDirection(args.direction, source);

  logger.info(`Previewing conversion: ${direction}`, { source });

  const engine = new ConversionEngine();
  const result = await engine.convert(source, target, direction, "diff");

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    logger.info("Pending changes:");
    logger.changes(result.changesApplied);
    logger.warnings(result.warnings);
  }
}

async function handleValidate(args: ParsedArgs): Promise<void> {
  const dir = resolve(args.dir || args.source || ".");

  const format = await detectPluginFormat(dir);
  if (format === "unknown") {
    logger.error("Cannot detect plugin format. Specify format or check directory.");
    process.exit(1);
  }

  logger.info(`Validating ${format} plugin`, { path: dir });

  const result = await validatePlugin(
    dir,
    format as "claude-code" | "opencode",
  );

  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.valid) {
      logger.info("Plugin is valid");
    } else {
      logger.error("Plugin validation failed");
    }
    for (const error of result.errors) {
      logger.error(`  ${error}`);
    }
    for (const warning of result.warnings) {
      logger.warn(`  ${warning}`);
    }
  }

  process.exit(result.valid ? 0 : 1);
}

async function handleDetect(args: ParsedArgs): Promise<void> {
  const dir = resolve(args.dir || args.source || ".");
  const format = await detectPluginFormat(dir);

  if (args.json) {
    console.log(JSON.stringify({ path: dir, format }));
  } else {
    logger.info(`Detected format: ${format}`, { path: dir });
  }
}

async function handleMarketplace(args: ParsedArgs): Promise<void> {
  const subcommand = args.subcommand;
  const marketplace = new MarketplaceConverter();

  switch (subcommand) {
    case "convert":
    case "sync": {
      if (!args.source || !args.target) {
        logger.error("--source and --target are required for marketplace operations");
        process.exit(1);
      }

      const source = resolve(args.source);
      const target = resolve(args.target);
      const direction = await resolveDirection(args.direction, source);

      logger.info(`Marketplace ${subcommand}: ${direction}`, { source, target });

      const report = await marketplace.convert({
        sourceDir: source,
        targetDir: target,
        direction,
        parallel: args.parallel,
        generateDocs: args.generateDocs,
        runValidation: args.runValidation,
        include: args.include,
        exclude: args.exclude,
      });

      if (args.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        logger.result("Marketplace conversion", {
          success: report.converted,
          failed: report.failed,
          warnings: report.warnings,
        });
        logger.info(
          `Processed ${report.totalPlugins} plugins in ${(report.duration / 1000).toFixed(1)}s`,
        );
      }
      break;
    }

    case "validate": {
      const dir = resolve(args.dir || args.source || ".");
      logger.info("Validating marketplace", { path: dir });

      // Validate each plugin in the marketplace
      const { readdir: readdirAsync } = await import("fs/promises");
      const entries = await readdirAsync(dir, { withFileTypes: true });
      let valid = 0;
      let invalid = 0;

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const pluginPath = resolve(dir, entry.name);
        const format = await detectPluginFormat(pluginPath);
        if (format === "unknown") continue;

        const result = await validatePlugin(pluginPath, format);
        if (result.valid) {
          valid++;
          logger.info(`  ${entry.name}: valid`);
        } else {
          invalid++;
          logger.error(`  ${entry.name}: invalid`);
          for (const e of result.errors) {
            logger.error(`    ${e}`);
          }
        }
      }

      logger.result("Marketplace validation", {
        success: valid,
        failed: invalid,
        warnings: 0,
      });
      process.exit(invalid > 0 ? 1 : 0);
      break;
    }

    case "init-ci": {
      const dir = resolve(args.dir || ".");
      if (!args.direction) {
        logger.error("--direction is required for init-ci");
        process.exit(1);
      }
      const direction = args.direction as ConversionDirection;

      logger.info("Generating CI workflows", { path: dir, direction });
      await marketplace.generateCIWorkflows(dir, direction);
      logger.info("CI workflows generated in .github/workflows/");
      break;
    }

    default:
      logger.error(`Unknown marketplace subcommand: ${subcommand}`);
      logger.info("Available: convert, sync, validate, init-ci");
      process.exit(1);
  }
}

// ── Main ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    console.log(VERSION);
    process.exit(0);
  }

  if (args.help || !args.command) {
    showHelp();
    process.exit(0);
  }

  if (args.verbose) setLogLevel("debug");
  if (args.json) setJsonOutput(true);

  switch (args.command) {
    case "convert":
      await handleConvert(args);
      break;
    case "sync":
      await handleSync(args);
      break;
    case "diff":
      await handleDiff(args);
      break;
    case "validate":
      await handleValidate(args);
      break;
    case "detect":
      await handleDetect(args);
      break;
    case "marketplace":
      await handleMarketplace(args);
      break;
    case "setup":
      await runFullSetup();
      break;
    default:
      logger.error(`Unknown command: ${args.command}`);
      showHelp();
      process.exit(1);
  }
}

main().catch((error) => {
  logger.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.stack) {
    logger.debug(error.stack);
  }
  process.exit(1);
});
