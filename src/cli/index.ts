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
 * Options:
 *   --source, -s     Source plugin directory
 *   --target, -t     Target output directory
 *   --direction, -d  Conversion direction (claude-to-opencode | opencode-to-claude | auto)
 *   --agentic        Enable agentic conversion using AI SDKs
 *   --sdk            Preferred SDK (claude | opencode | auto)
 *   --budget         Max budget for agentic conversion in USD
 *   --json           Output results as JSON
 *   --verbose, -v    Verbose output
 *   --help, -h       Show help
 *   --version        Show version
 */

import { resolve } from "path";
import { ConversionEngine } from "../converters/engine";
import { AgenticConverter } from "../agents/agentic-converter";
import { MarketplaceConverter } from "../marketplace/marketplace-converter";
import { validatePlugin, detectPluginFormat } from "../utils/validator";
import { logger, setLogLevel, setJsonOutput } from "../utils/logger";
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
  sdk?: string;
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
      case "--sdk":
        parsed.sdk = args[++j];
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
  --agentic                Enable AI-powered agentic conversion
  --sdk <sdk>              Preferred SDK: claude | opencode | auto
  --budget <usd>           Max budget for agentic conversion (default: 0.50)
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
  # Convert a Claude Code plugin to OpenCode
  plugin-convert convert -s ./my-plugin -t ./my-plugin-opencode -d claude-to-opencode

  # Sync changes incrementally
  plugin-convert sync -s ./my-plugin -t ./my-plugin-opencode -d auto

  # Preview changes without applying
  plugin-convert diff -s ./my-plugin -t ./my-plugin-opencode -d auto

  # Validate a converted plugin
  plugin-convert validate --dir ./my-plugin-opencode

  # Convert entire marketplace with agentic assistance
  plugin-convert marketplace convert \\
    -s ./claude-marketplace -t ./opencode-marketplace \\
    -d claude-to-opencode --agentic --generate-docs

  # Generate CI workflows for a marketplace fork
  plugin-convert marketplace init-ci --dir ./opencode-marketplace -d claude-to-opencode
`);
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
  let result = await engine.convert(source, target, direction, "full");

  // Run agentic conversion if enabled
  if (args.agentic) {
    logger.info("Running agentic conversion...");
    const agenticConverter = new AgenticConverter();
    const agenticResult = await agenticConverter.convert({
      direction,
      sourcePath: source,
      outputPath: target,
      maxBudgetUsd: args.budget,
      enabled: true,
      preferredSdk: (args.sdk as "claude" | "opencode" | "auto") || "auto",
    });

    result.warnings.push(...agenticResult.warnings);
    result.changesApplied.push(...agenticResult.changes);
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
