/**
 * Structured logging utility for the plugin converter.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_COLORS: Record<LogLevel, string> = {
  debug: "\x1b[90m",
  info: "\x1b[36m",
  warn: "\x1b[33m",
  error: "\x1b[31m",
};

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";

let currentLevel: LogLevel = "info";
let jsonOutput = false;

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function setJsonOutput(enabled: boolean): void {
  jsonOutput = enabled;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
}

function log(level: LogLevel, message: string, data?: Record<string, unknown>): void {
  if (!shouldLog(level)) return;

  if (jsonOutput) {
    const entry: Record<string, unknown> = {
      level,
      message,
      timestamp: new Date().toISOString(),
    };
    if (data) entry.data = data;
    console.log(JSON.stringify(entry));
    return;
  }

  const color = LEVEL_COLORS[level];
  const prefix = `${color}${BOLD}[${level.toUpperCase()}]${RESET}`;
  const timestamp = new Date().toLocaleTimeString();

  let output = `${prefix} ${message}`;
  if (data) {
    const dataStr = Object.entries(data)
      .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
      .join(" ");
    output += ` ${LEVEL_COLORS.debug}${dataStr}${RESET}`;
  }

  if (level === "error") {
    console.error(output);
  } else {
    console.log(output);
  }
}

export const logger = {
  debug: (msg: string, data?: Record<string, unknown>) => log("debug", msg, data),
  info: (msg: string, data?: Record<string, unknown>) => log("info", msg, data),
  warn: (msg: string, data?: Record<string, unknown>) => log("warn", msg, data),
  error: (msg: string, data?: Record<string, unknown>) => log("error", msg, data),

  /** Log a conversion result summary */
  result(label: string, stats: { success: number; failed: number; warnings: number }): void {
    const color = stats.failed > 0 ? LEVEL_COLORS.error : LEVEL_COLORS.info;
    console.log(
      `\n${BOLD}${label}${RESET}: ${color}${stats.success} converted${RESET}, ` +
        `${stats.failed > 0 ? LEVEL_COLORS.error : LEVEL_COLORS.debug}${stats.failed} failed${RESET}, ` +
        `${stats.warnings > 0 ? LEVEL_COLORS.warn : LEVEL_COLORS.debug}${stats.warnings} warnings${RESET}`,
    );
  },

  /** Log a table of changes */
  changes(changes: Array<{ type: string; component: string; description: string }>): void {
    if (changes.length === 0) return;
    console.log(`\n${BOLD}Changes:${RESET}`);
    for (const change of changes) {
      const typeColor =
        change.type === "added"
          ? "\x1b[32m"
          : change.type === "removed"
            ? "\x1b[31m"
            : "\x1b[33m";
      console.log(
        `  ${typeColor}${change.type.padEnd(8)}${RESET} [${change.component}] ${change.description}`,
      );
    }
  },

  /** Log warnings grouped by severity */
  warnings(
    warnings: Array<{ severity: string; component: string; message: string; suggestion?: string }>,
  ): void {
    if (warnings.length === 0) return;
    console.log(`\n${BOLD}Warnings:${RESET}`);
    for (const warning of warnings) {
      const color =
        warning.severity === "error"
          ? LEVEL_COLORS.error
          : warning.severity === "warning"
            ? LEVEL_COLORS.warn
            : LEVEL_COLORS.debug;
      console.log(`  ${color}${warning.severity.toUpperCase()}${RESET} [${warning.component}] ${warning.message}`);
      if (warning.suggestion) {
        console.log(`         ${LEVEL_COLORS.debug}Suggestion: ${warning.suggestion}${RESET}`);
      }
    }
  },
};
