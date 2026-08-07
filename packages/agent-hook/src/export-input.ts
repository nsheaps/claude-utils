/**
 * Turning a hook's stdin payload into shell variables.
 *
 *   HOOK_INPUT="$(cat)"
 *   eval "$(agent-hook export-input "$HOOK_INPUT")"
 *   # ... now $HOOK_EVENT_NAME, $HOOK_TOOL_NAME, $HOOK_TOOL_INPUT_COMMAND, ... are set
 *
 * SECURITY: the output of this command is executed by `eval`. Everything below exists to make that
 * safe, and changing any of it needs care.
 *
 * Two independent controls, because the payload is entirely attacker-influenced — a prompt, a file
 * path, or a tool argument can contain any bytes at all:
 *
 *   1. VALUES are wrapped in single quotes, which suppress every form of shell expansion, and any
 *      single quote inside a value is emitted as '\'' — close the quoted run, emit an escaped
 *      quote, reopen. That is the only sequence that terminates a single-quoted string, so this is
 *      what stops a value from breaking out of its quotes. A value containing
 *      `'; rm -rf ~; echo '` becomes inert text.
 *
 *   2. KEYS are rebuilt from scratch rather than escaped, because quoting cannot protect the
 *      left-hand side of an assignment. Every character outside [A-Z0-9_] is replaced with an
 *      underscore, and the result then has to match ^[A-Z_][A-Z0-9_]*$ or the entry is dropped. So
 *      a key of `a; echo INJECTED; b` is emitted as the harmless variable name HOOK_A_ECHO_INJECTED_B
 *      — the shell metacharacters are gone, not quoted — and anything that still cannot form an
 *      identifier never reaches the output at all.
 *
 * Nothing else in the emitted line is variable: the literal text is `export `, `=`, and the quotes.
 */

/** Wrap a value so `eval` treats it as one inert literal. See control (1) above. */
export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

/**
 * Build a shell variable name from a payload key path. See control (2) above.
 *
 * Metacharacters become underscores; only a result that is already a valid identifier is returned,
 * and undefined (which the caller drops) for anything that still is not.
 * `hook_event_name` becomes HOOK_EVENT_NAME rather than HOOK_HOOK_EVENT_NAME — the redundant
 * leading segment is dropped because the prefix already says it.
 */
export function shellVarName(path: string[], prefix = "HOOK"): string | undefined {
  const body = path
    .join("_")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2") // camelCase keys still split on the case change
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    // The payload's own `hook_event_name` would otherwise become HOOK_HOOK_EVENT_NAME. Strip the
    // redundant leading segment, since the prefix already says it. Done on the joined, uppercased
    // body rather than on path[0] because the redundancy lives inside a single key's name.
    .replace(/^HOOK_/, "");

  const name = body ? `${prefix}_${body}` : prefix;
  // Collapse runs introduced by substitution, and require a valid identifier shape.
  const collapsed = name.replace(/_+/g, "_").replace(/_$/, "");
  return /^[A-Z_][A-Z0-9_]*$/.test(collapsed) ? collapsed : undefined;
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

/** How deep to flatten nested objects into their own variables. */
const MAX_DEPTH = 3;

/**
 * Flatten a payload into [name, value] pairs.
 *
 * A nested object is emitted twice on purpose: once whole, as compact JSON, and once as one
 * variable per scalar leaf. The whole form is what a hook pipes back into a JSON tool; the
 * flattened form is what a hook tests with `[ "$HOOK_TOOL_INPUT_COMMAND" = ... ]` without needing
 * jq. Arrays are only ever emitted whole — an index in a variable name is not worth reading.
 */
export function flattenPayload(
  payload: Record<string, JsonValue>,
  prefix = "HOOK",
): [string, string][] {
  const out: [string, string][] = [];
  const seen = new Set<string>();

  const push = (path: string[], value: string) => {
    const name = shellVarName(path, prefix);
    if (!name || seen.has(name)) return;
    seen.add(name);
    out.push([name, value]);
  };

  const walk = (obj: Record<string, JsonValue>, path: string[], depth: number) => {
    for (const [key, value] of Object.entries(obj)) {
      const childPath = [...path, key];
      if (value === null) {
        push(childPath, "");
      } else if (Array.isArray(value)) {
        push(childPath, JSON.stringify(value));
      } else if (typeof value === "object") {
        push(childPath, JSON.stringify(value));
        if (depth < MAX_DEPTH) walk(value as Record<string, JsonValue>, childPath, depth + 1);
      } else {
        push(childPath, String(value));
      }
    }
  };

  walk(payload, [], 1);
  return out;
}

export class InvalidPayloadError extends Error {
  constructor(detail: string) {
    super(`Could not read the hook payload: ${detail}`);
    this.name = "InvalidPayloadError";
  }
}

/**
 * Render the `export` lines for a raw JSON payload.
 *
 * The raw payload is also re-exported whole as HOOK_INPUT_JSON, so a hook that needs a field this
 * did not flatten can still reach it with jq without having to keep its own copy.
 */
export function exportInput(raw: string, prefix = "HOOK"): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new InvalidPayloadError(e instanceof Error ? e.message : String(e));
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new InvalidPayloadError("expected a JSON object at the top level");
  }

  const pairs = flattenPayload(parsed as Record<string, JsonValue>, prefix);
  const lines = pairs.map(([name, value]) => `export ${name}=${shellQuote(value)}`);
  lines.push(`export ${prefix}_INPUT_JSON=${shellQuote(JSON.stringify(parsed))}`);
  return `${lines.join("\n")}\n`;
}
