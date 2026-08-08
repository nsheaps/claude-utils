/**
 * Per-plugin settings files, addressed with dotted keys.
 *
 * One file per plugin, at `<project>/.claude/settings.<plugin>.(yaml|yml|json)`. This is a
 * deliberate departure from the single-shared-file convention used elsewhere: a plugin that owns
 * its own file can be added, removed, or copied between projects without a merge, and two plugins
 * writing settings at the same time cannot clobber each other.
 *
 * `<project>` is `CLAUDE_PROJECT_DIR` when set (Claude Code sets it for hooks, which do not
 * reliably run from the project root) and the current directory otherwise.
 *
 * Keys are dotted paths in the style of `git config`: `read` fetches one nested key, and `write`
 * replaces exactly that key and leaves every other key, and in YAML every comment, untouched.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import { basename, join } from "node:path";
import YAML from "yaml";

/** Extensions we recognise, in the order a read prefers them when several files exist. */
const EXTENSIONS = ["yaml", "yml", "json"] as const;
export type SettingsFormat = (typeof EXTENSIONS)[number];

/**
 * Filenames under .claude/ that match the `settings.<something>.<ext>` shape but belong to Claude
 * Code itself, not to a plugin. Without this, `settings.local.json` would be reported as the
 * settings of a plugin named "local" — and `--all` would offer to rewrite the user's own config.
 */
const RESERVED_MIDDLE_SEGMENTS = new Set(["local"]);

export function projectDir(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): string {
  const fromEnv = env.CLAUDE_PROJECT_DIR;
  return fromEnv && fromEnv.length > 0 ? fromEnv : cwd;
}

export function claudeDir(env?: NodeJS.ProcessEnv, cwd?: string): string {
  return join(projectDir(env, cwd), ".claude");
}

export interface SettingsFile {
  path: string;
  format: SettingsFormat;
  /** False when no file exists yet — the path is where a write would create one. */
  exists: boolean;
}

/**
 * Locate a plugin's settings file. When more than one extension exists, the first match in
 * EXTENSIONS wins, so an accidental second file cannot silently shadow the one being edited.
 * When none exists, YAML is the format a write will create, because these files are meant to be
 * hand-edited and YAML can carry comments.
 */
export function resolveSettingsFile(
  plugin: string,
  env?: NodeJS.ProcessEnv,
  cwd?: string,
): SettingsFile {
  const dir = claudeDir(env, cwd);
  for (const format of EXTENSIONS) {
    const path = join(dir, `settings.${plugin}.${format}`);
    if (existsSync(path)) return { path, format, exists: true };
  }
  return { path: join(dir, `settings.${plugin}.yaml`), format: "yaml", exists: false };
}

export class SettingsParseError extends Error {
  constructor(path: string, cause: unknown) {
    super(`Failed to parse ${path}: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "SettingsParseError";
  }
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

/** Read and parse a plugin's whole settings object. A missing file reads as `{}`. */
export function readSettings(file: SettingsFile): Record<string, JsonValue> {
  if (!file.exists) return {};
  const text = readFileSync(file.path, "utf8");
  try {
    const parsed = file.format === "json" ? JSON.parse(text) : YAML.parse(text);
    // An empty file parses to null/undefined in both formats; treat it as no settings rather
    // than letting `null.foo` blow up further down.
    if (parsed === null || parsed === undefined) return {};
    if (typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`expected a mapping at the top level, got ${typeof parsed}`);
    }
    return parsed as Record<string, JsonValue>;
  } catch (e) {
    throw new SettingsParseError(file.path, e);
  }
}

export function splitKey(key: string): string[] {
  const parts = key.split(".");
  if (parts.length === 0 || parts.some((p) => p === "")) {
    throw new Error(
      `Invalid key ${JSON.stringify(key)}. Expected dotted segments like "autoInstall" or "a.b.c".`,
    );
  }
  return parts;
}

/** Follow a dotted path. Returns undefined for any segment that is missing or not a mapping. */
export function getIn(obj: unknown, path: string[]): JsonValue | undefined {
  let cur: unknown = obj;
  for (const segment of path) {
    if (typeof cur !== "object" || cur === null || Array.isArray(cur)) return undefined;
    cur = (cur as Record<string, unknown>)[segment];
    if (cur === undefined) return undefined;
  }
  return cur as JsonValue;
}

/**
 * Interpret a value supplied on the command line.
 *
 * Command-line arguments are always strings, but a settings file holds real types — `autoInstall`
 * is expected to be a boolean, not the string "true". Values are therefore coerced to match what a
 * human editing the file by hand would get: `true`/`false` become booleans, `42` and `1.5` become
 * numbers, `null` and `~` become null, and anything else stays a string.
 *
 * Quoting forces a string, exactly as it does in the file: `'true'` stores the four-character
 * string. That is the escape hatch for the one case this coercion would otherwise make
 * unreachable.
 */
export function coerceValue(raw: string): JsonValue {
  // Each case is matched explicitly rather than by handing the whole string to YAML.parse and
  // trusting whatever comes back. Parsing arbitrary input as a YAML document has surprises that
  // are wrong for a command-line value: `#comment` parses to null, `a: b` to a mapping, and a
  // leading `*` or `&` is an error. Being explicit keeps the rule short enough to document.
  if (/^(true|false)$/i.test(raw)) return raw.toLowerCase() === "true";
  if (raw === "null" || raw === "~") return null;
  // A number only when the whole string is one, so version-like values ("1.2.3") stay strings.
  if (/^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/.test(raw)) return Number(raw);
  // Quoting is the escape hatch that forces a string, exactly as it does inside the file. Strip
  // one layer of matching quotes so `'true'` stores the four-character string.
  const quoted = /^'(.*)'$/s.exec(raw) ?? /^"(.*)"$/s.exec(raw);
  if (quoted) return quoted[1]!;
  return raw;
}

/**
 * Write one dotted key, creating intermediate mappings as needed, and leave everything else alone.
 *
 * For YAML this goes through the document model rather than parse-and-re-serialise, so comments,
 * key order, and quoting style in the rest of the file all survive. That matters because these
 * files are meant to be hand-edited: a plugin writing one key should not reformat a user's file.
 */
export function writeSetting(file: SettingsFile, key: string, value: JsonValue): void {
  const path = splitKey(key);
  mkdirSync(claudeDirOf(file.path), { recursive: true });

  if (file.format === "json") {
    const current = readSettings(file);
    setIn(current, path, value);
    writeFileSync(file.path, `${JSON.stringify(current, null, 2)}\n`, "utf8");
    return;
  }

  const text = file.exists ? readFileSync(file.path, "utf8") : "";
  let doc;
  try {
    doc = YAML.parseDocument(text);
  } catch (e) {
    throw new SettingsParseError(file.path, e);
  }
  // setIn creates the intermediate mappings itself, including on a document with no contents at
  // all, so a brand new file needs no special case.
  doc.setIn(path, value);
  writeFileSync(file.path, doc.toString(), "utf8");
}

function claudeDirOf(filePath: string): string {
  return filePath.slice(0, filePath.length - basename(filePath).length) || ".";
}

/** Set a dotted path on a plain object, replacing non-mapping intermediates. */
export function setIn(obj: Record<string, JsonValue>, path: string[], value: JsonValue): void {
  let cur: Record<string, JsonValue> = obj;
  for (const segment of path.slice(0, -1)) {
    const next = cur[segment];
    if (typeof next !== "object" || next === null || Array.isArray(next)) {
      cur[segment] = {};
    }
    cur = cur[segment] as Record<string, JsonValue>;
  }
  cur[path[path.length - 1]!] = value;
}

/**
 * Every plugin that has a settings file in this project, in sorted order.
 *
 * Derived from the filenames rather than from any registry, so a plugin appears here as soon as it
 * has written a setting. Claude Code's own `settings.json` has no middle segment and so never
 * matches; `settings.local.json` does match the shape and is excluded by name.
 */
export function listPlugins(env?: NodeJS.ProcessEnv, cwd?: string): string[] {
  const dir = claudeDir(env, cwd);
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const found = new Set<string>();
  for (const entry of entries) {
    const match = /^settings\.(.+)\.(yaml|yml|json)$/.exec(entry);
    if (!match) continue;
    const plugin = match[1]!;
    // A name with a dot in it would be ambiguous with the `settings.<plugin>.<ext>` shape, and
    // reserved names belong to Claude Code rather than to a plugin.
    if (plugin.includes(".") || RESERVED_MIDDLE_SEGMENTS.has(plugin)) continue;
    found.add(plugin);
  }
  return [...found].toSorted();
}

/** Render a value for stdout: scalars bare, structures as YAML so they stay readable. */
export function formatValue(value: JsonValue): string {
  if (value === null) return "null";
  if (typeof value === "object") return YAML.stringify(value).trimEnd();
  return String(value);
}
