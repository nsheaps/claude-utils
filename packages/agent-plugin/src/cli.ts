/**
 * Argument parsing and dispatch for `agent-plugin`.
 *
 * Kept separate from index.ts so the whole CLI can be driven from a test with injected streams and
 * environment, and asserted on by exit code and output, without spawning a process.
 */

import {
  coerceValue,
  formatValue,
  getIn,
  listPlugins,
  readSettings,
  resolveSettingsFile,
  splitKey,
  writeSetting,
} from "./settings.js";
import type { JsonValue } from "./settings.js";
import { createLogger, isLevel, LEVELS, resolveThreshold } from "./log.js";
import type { Level } from "./log.js";
import { commandExists, ensureDependency, readAutoInstall, runCommand } from "./dependencies.js";
import { resolvePluginName } from "./plugin-name.js";

export const HELP = `Usage: agent-plugin [--plugin <name>] <command> [args]

The plugin name comes from --plugin or $AGENT_PLUGIN_NAME. It is required for every command
except \`settings get-all --all\`, and is never guessed.

Logging (all output goes to stderr):
  log <message>            same as log-info
  log-trace <message>
  log-debug <message>
  log-info <message>
  log-warn <message>
  log-error <message>

  Lines below the threshold are dropped. The threshold is $AGENT_PLUGIN_LOG_LEVEL, else this
  plugin's own \`logLevel\` setting, else info. Levels: ${LEVELS.join(" < ")}.

Settings (one file per plugin, .claude/settings.<plugin>.yaml|yml|json):
  settings <dotted.key>            print one value
  settings <dotted.key> <value>    write one value, leaving the rest of the file untouched
  settings get-all                 print every setting for this plugin
  settings get-all --all           print every setting for every plugin, grouped by plugin

  Written values are read with YAML scalar rules, so \`true\` stores a boolean and \`42\` a
  number. Quote to force a string: \`'true'\`.

Dependencies:
  ensure-dependency <cli> <mise-package>
                           Make sure <cli> is runnable, installing <mise-package> via
                           \`mise use -g\` when this plugin's \`autoInstall\` setting is true.
                           autoInstall defaults to false. The caller never passes it.

  example: agent-plugin ensure-dependency gh "gh@latest"

Options:
  --plugin <name>          the plugin to act on
  --all                    with \`settings get-all\` only: every plugin
  -h, --help               show this help
`;

export interface Io {
  stdout: { write(chunk: string): unknown };
  stderr: { write(chunk: string): unknown; isTTY?: boolean };
  env: NodeJS.ProcessEnv;
  cwd: string;
  /** Overridable so ensure-dependency can be tested without touching the real PATH or mise. */
  hasCommand?: (cli: string) => boolean;
  run?: (cmd: string, args: string[]) => { code: number; output: string };
}

interface ParsedArgs {
  plugin?: string;
  all: boolean;
  help: boolean;
  positional: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { all: false, help: false, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--plugin") {
      const value = argv[++i];
      if (value === undefined) throw new Error("--plugin requires a value");
      out.plugin = value;
    } else if (a.startsWith("--plugin=")) {
      out.plugin = a.slice("--plugin=".length);
    } else if (a === "--all") {
      out.all = true;
    } else if (a === "-h" || a === "--help") {
      out.help = true;
    } else if (a === "--") {
      // Everything after `--` is a positional, so a message that starts with a hyphen can be
      // logged without being read as a flag.
      out.positional.push(...argv.slice(i + 1));
      break;
    } else {
      out.positional.push(a);
    }
  }
  return out;
}

/** The subcommand names that log a message, mapped to the level they log at. */
const LOG_COMMANDS: Record<string, Level> = {
  log: "info",
  "log-trace": "trace",
  "log-debug": "debug",
  "log-info": "info",
  "log-warn": "warn",
  "log-error": "error",
};

export function main(argv: string[], io: Io): number {
  let args: ParsedArgs;
  try {
    args = parseArgs(argv);
  } catch (e) {
    io.stderr.write(`ERROR: ${errText(e)}\n`);
    return 2;
  }

  if (args.help || args.positional.length === 0) {
    io.stdout.write(HELP);
    return args.help ? 0 : 2;
  }

  const command = args.positional[0]!;
  const rest = args.positional.slice(1);

  try {
    if (command in LOG_COMMANDS) return doLog(command, rest, args, io);
    if (command === "settings") return doSettings(rest, args, io);
    if (command === "ensure-dependency") return doEnsureDependency(rest, args, io);
    io.stderr.write(`ERROR: Unknown command ${JSON.stringify(command)}. Try --help.\n`);
    return 2;
  } catch (e) {
    io.stderr.write(`ERROR: ${errText(e)}\n`);
    return 1;
  }
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** Build a logger for `plugin`, with the threshold resolved from env and the plugin's settings. */
function loggerFor(plugin: string, io: Io) {
  let logLevelSetting: JsonValue | undefined;
  try {
    logLevelSetting = getIn(readSettings(resolveSettingsFile(plugin, io.env, io.cwd)), [
      "logLevel",
    ]);
  } catch {
    // A settings file that will not parse must not stop a log line from being written — the log
    // line is quite possibly what is about to explain the broken file.
    logLevelSetting = undefined;
  }
  return createLogger({
    plugin,
    threshold: resolveThreshold(io.env, logLevelSetting),
    stream: io.stderr,
  });
}

function doLog(command: string, rest: string[], args: ParsedArgs, io: Io): number {
  const level = LOG_COMMANDS[command]!;
  if (rest.length === 0) {
    io.stderr.write(`ERROR: ${command} requires a message.\n`);
    return 2;
  }
  const plugin = resolvePluginName(
    args.plugin,
    io.env,
    "Every log line is tagged with the plugin it came from.",
  );
  // Join rather than requiring one argument: an unquoted message arrives as several words, and
  // silently logging only the first would be worse than the shell's own behaviour.
  loggerFor(plugin, io)(level, rest.join(" "));
  return 0;
}

function doSettings(rest: string[], args: ParsedArgs, io: Io): number {
  if (rest.length === 0) {
    io.stderr.write(`ERROR: settings requires a key, or \`get-all\`. Try --help.\n`);
    return 2;
  }

  if (rest[0] === "get-all") {
    if (args.all) {
      // The one command that works without a plugin name. Note this branch is only reachable when
      // --all was passed explicitly; the plain form below still requires a name.
      const plugins = listPlugins(io.env, io.cwd);
      if (plugins.length === 0) {
        io.stderr.write("No plugin settings files found.\n");
        return 0;
      }
      for (const plugin of plugins) {
        io.stdout.write(`# ${plugin}\n`);
        writeAllSettings(plugin, io);
      }
      return 0;
    }
    const plugin = resolvePluginName(
      args.plugin,
      io.env,
      "To list settings for every plugin instead, pass --all.",
    );
    writeAllSettings(plugin, io);
    return 0;
  }

  if (args.all) {
    io.stderr.write("ERROR: --all applies to `settings get-all` only.\n");
    return 2;
  }

  const plugin = resolvePluginName(args.plugin, io.env, "Settings are stored per plugin.");
  const key = rest[0]!;
  const file = resolveSettingsFile(plugin, io.env, io.cwd);

  if (rest.length === 1) {
    const value = getIn(readSettings(file), splitKey(key));
    if (value === undefined) {
      io.stderr.write(`ERROR: ${plugin}: no such setting ${JSON.stringify(key)}\n`);
      return 1;
    }
    io.stdout.write(`${formatValue(value)}\n`);
    return 0;
  }

  if (rest.length > 2) {
    io.stderr.write(
      `ERROR: settings takes at most a key and one value. ` +
        `Quote the value if it contains spaces.\n`,
    );
    return 2;
  }

  writeSetting(file, key, coerceValue(rest[1]!));
  loggerFor(plugin, io)("debug", `set ${key} in ${file.path}`);
  return 0;
}

function writeAllSettings(plugin: string, io: Io): void {
  const settings = readSettings(resolveSettingsFile(plugin, io.env, io.cwd));
  const keys = flatten(settings);
  for (const [key, value] of keys) {
    io.stdout.write(`${key}=${formatValue(value)}\n`);
  }
}

/**
 * Flatten nested settings to dotted `key=value` pairs, so `get-all` output uses the same key
 * spelling that `settings <key>` accepts. Arrays are values, not levels to descend into.
 */
export function flatten(obj: Record<string, JsonValue>, prefix = ""): [string, JsonValue][] {
  const out: [string, JsonValue][] = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      out.push(...flatten(v as Record<string, JsonValue>, key));
    } else {
      out.push([key, v]);
    }
  }
  return out;
}

function doEnsureDependency(rest: string[], args: ParsedArgs, io: Io): number {
  if (rest.length !== 2) {
    io.stderr.write(
      `ERROR: ensure-dependency requires a cli name and a mise package, ` +
        `e.g. \`agent-plugin ensure-dependency gh "gh@latest"\`.\n`,
    );
    return 2;
  }
  const [cli, misePackage] = rest as [string, string];
  const plugin = resolvePluginName(
    args.plugin,
    io.env,
    "The plugin name is needed to tag what gets logged.",
  );
  const file = resolveSettingsFile(plugin, io.env, io.cwd);
  const autoInstall = readAutoInstall(getIn(readSettings(file), ["autoInstall"]));

  const outcome = ensureDependency(cli, misePackage, {
    hasCommand: io.hasCommand ?? commandExists,
    run: io.run ?? runCommand,
    autoInstall,
    log: loggerFor(plugin, io),
  });

  // A dependency that is still missing is a failure the caller has to be able to branch on, so it
  // gets a non-zero exit even though the message has already been logged.
  return outcome.status === "present" || outcome.status === "installed" ? 0 : 1;
}

export { isLevel };
