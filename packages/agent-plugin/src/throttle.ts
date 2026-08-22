/**
 * Throttling a check a hook does not want to repeat on every invocation.
 *
 * Claude Code fires a `PreToolUse` hook before every single tool call, so a hook that does
 * non-trivial work (checking a token's expiry, re-parsing `.envrc`, ...) needs a way to avoid
 * redoing that work on every call. State here is one timestamp per key: "was this key's check run
 * recently". The caller decides what "recently enough" means (the interval) and what the key is —
 * there is no single global throttle policy baked in here.
 *
 * State is written under `CLAUDE_PLUGIN_DATA`, Claude Code's persistent-data-directory for a
 * plugin (https://code.claude.com/docs/en/plugins-reference#persistent-data-directory), rather
 * than under the project's `.claude/` alongside `settings.ts`'s per-plugin settings files. Those
 * settings files are meant to be hand-edited and comitted; a timestamp rewritten on every hook
 * call has no business living next to them. `resolveStateDir` mirrors `plugin-name.ts`'s
 * `resolvePluginName`: an explicit flag wins over the environment, and a missing value is an
 * error, never a guess.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export class MissingStateDirError extends Error {
  constructor() {
    super(
      "Cannot determine where to store throttle state. Pass --state-dir <dir> or set " +
        "CLAUDE_PLUGIN_DATA (Claude Code sets this for plugin hooks).",
    );
    this.name = "MissingStateDirError";
  }
}

/** Resolve the throttle state directory from an already-parsed `--state-dir` and the environment. */
export function resolveStateDir(
  fromFlag: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const candidate = fromFlag ?? env.CLAUDE_PLUGIN_DATA;
  if (candidate === undefined || candidate.trim() === "") {
    throw new MissingStateDirError();
  }
  return candidate;
}

/**
 * Path to KEY's state file within `stateDir`. Every character outside [A-Za-z0-9._-] is replaced
 * with `_`, so a caller can pass a human-readable key like "github-app/token-check" without
 * worrying about path separators ending up somewhere they should not.
 */
export function stateFile(stateDir: string, key: string): string {
  const safeKey = key.replace(/[^A-Za-z0-9._-]/g, "_");
  return join(stateDir, `throttle.${safeKey}.json`);
}

interface ThrottleState {
  /** Unix epoch seconds of the last recorded run. */
  lastRun: number;
}

function readLastRun(file: string): number | undefined {
  if (!existsSync(file)) return undefined;
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<ThrottleState>;
    return typeof parsed.lastRun === "number" ? parsed.lastRun : undefined;
  } catch {
    // A corrupt state file is treated the same as "never recorded" rather than failing the
    // caller's hook outright — the worst case is one extra check running.
    return undefined;
  }
}

export interface ShouldRunOptions {
  /**
   * Always allow the check to run, regardless of throttle state. Use this when the caller already
   * knows the state behind the check is definitely stale (e.g. a token already known to be
   * expired) — that case must never be suppressed just because a check ran recently.
   */
  force?: boolean;
  /** Injectable clock, in Unix epoch milliseconds. Defaults to `Date.now`. */
  now?: () => number;
}

/**
 * Whether a throttled check for `key` should run now.
 *
 * True when `force` is set, `key` has never been recorded, or at least `intervalSeconds` have
 * elapsed since the last recorded run. False otherwise — still within the throttle window.
 *
 * This does not record anything itself; call `record` once the check has actually run.
 */
export function shouldRun(
  stateDir: string,
  key: string,
  intervalSeconds: number,
  opts: ShouldRunOptions = {},
): boolean {
  if (opts.force) return true;

  const lastRun = readLastRun(stateFile(stateDir, key));
  if (lastRun === undefined) return true;

  const now = (opts.now ?? Date.now)() / 1000;
  return now - lastRun >= intervalSeconds;
}

/** Record that `key`'s check ran now. Creates `stateDir` if it does not exist yet. */
export function record(stateDir: string, key: string, now: () => number = Date.now): void {
  mkdirSync(stateDir, { recursive: true });
  const state: ThrottleState = { lastRun: now() / 1000 };
  writeFileSync(stateFile(stateDir, key), JSON.stringify(state), "utf8");
}

/** Seconds since `key` was last recorded, or undefined if it never has been (or is unreadable). */
export function secondsSince(
  stateDir: string,
  key: string,
  now: () => number = Date.now,
): number | undefined {
  const lastRun = readLastRun(stateFile(stateDir, key));
  if (lastRun === undefined) return undefined;
  return now() / 1000 - lastRun;
}
