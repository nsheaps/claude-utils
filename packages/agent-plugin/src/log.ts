/**
 * Levelled logging for plugins, tagged with the plugin's name.
 *
 * Everything goes to stderr, never stdout. Plugin scripts and hooks use stdout for their actual
 * payload — a hook's whole contract is a JSON document on stdout — so a log line written there
 * would corrupt it. stderr is also what Claude Code surfaces in its debug output.
 *
 * The threshold is `AGENT_PLUGIN_LOG_LEVEL` if set, otherwise the plugin's own `logLevel` setting,
 * otherwise `info`. Reading the plugin's setting means verbosity can be turned up for one plugin
 * in a project without affecting the others or touching the environment.
 */

import type { JsonValue } from "./settings.js";

export const LEVELS = ["trace", "debug", "info", "warn", "error"] as const;
export type Level = (typeof LEVELS)[number];

function rank(level: Level): number {
  return LEVELS.indexOf(level);
}

export function isLevel(value: string): value is Level {
  return (LEVELS as readonly string[]).includes(value);
}

/** ANSI codes per level. Dim for the two levels that are off by default, colour for the rest. */
const COLORS: Record<Level, string> = {
  trace: "2",
  debug: "2",
  info: "36",
  warn: "33",
  error: "31",
};

export interface LoggerOptions {
  plugin: string;
  threshold: Level;
  stream?: { write(chunk: string): unknown; isTTY?: boolean };
  /** Honours NO_COLOR; separated out so tests can force it either way. */
  color?: boolean;
}

export function resolveThreshold(
  env: NodeJS.ProcessEnv,
  settingValue: JsonValue | undefined,
): Level {
  const fromEnv = env.AGENT_PLUGIN_LOG_LEVEL?.trim().toLowerCase();
  if (fromEnv && isLevel(fromEnv)) return fromEnv;
  if (typeof settingValue === "string" && isLevel(settingValue.trim().toLowerCase())) {
    return settingValue.trim().toLowerCase() as Level;
  }
  return "info";
}

export function createLogger(opts: LoggerOptions) {
  const stream = opts.stream ?? process.stderr;
  const useColor = opts.color ?? (!process.env.NO_COLOR && Boolean(stream.isTTY));

  return function log(level: Level, message: string): void {
    if (rank(level) < rank(opts.threshold)) return;
    const label = level.toUpperCase();
    const tag = useColor ? `\x1b[${COLORS[level]}m${label}\x1b[0m` : label;
    stream.write(`${tag} [${opts.plugin}] ${message}\n`);
  };
}
