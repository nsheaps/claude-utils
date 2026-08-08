/**
 * The JSON documents a hook answers with.
 *
 * Hoisted from a project-local `hooks/lib/json.sh` and made generic. Two conventions came across
 * from it unchanged because they are properties of the hook protocol rather than of any one project:
 *
 *   1. Every outcome carries a message for each audience — one for the model, one for the developer
 *      watching. They are different fields and they are read by different readers, so a helper that
 *      takes only one message forces the caller to pick which audience to serve.
 *
 *   2. Every helper exits 0. On exit 2 the harness discards the JSON on stdout and uses stderr as
 *      the reason instead, so a helper that exits non-zero silently throws away everything it just
 *      built. Blocking is expressed *in* the JSON, never by the exit status.
 *
 * What did NOT come across: the escape-walking string surgery that read the tool payload out of raw
 * JSON with sed and awk, and the regex fragments for matching git command lines. The first only
 * existed because bash had to parse JSON by hand — JSON.parse makes it unnecessary, and correct.
 * The second was specific to that project's own rules.
 *
 * Field names below are camelCase because hook OUTPUT is camelCase, while hook INPUT is snake_case.
 * Getting that backwards produces JSON the harness silently ignores.
 */

/** Output shapes, as verified against the Claude Code hooks reference. */
export interface HookOutput {
  /** false stops the agent entirely; the user has to send another prompt to resume. */
  continue?: boolean;
  /** Shown to the user, and only meaningful alongside `continue: false`. */
  stopReason?: string;
  /** Shown to the user as a warning. Works on any event. */
  systemMessage?: string;
  /**
   * PostToolUse only. The documented way to make feedback actionable rather than informational.
   * Paired with `additionalContext` rather than the `reason` field it is usually shown with —
   * `additionalContext` is injected into the model's context, so the explanation still reaches the
   * model, and it keeps every message this CLI emits in one field per audience.
   */
  decision?: "block";
  hookSpecificOutput?: PreToolUseOutput | PostToolUseOutput;
}

export interface PreToolUseOutput {
  hookEventName: "PreToolUse";
  permissionDecision: "allow" | "deny" | "ask" | "defer";
  /** Read by the model. For a denial this is where the alternative to suggest goes. */
  permissionDecisionReason: string;
}

export interface PostToolUseOutput {
  hookEventName: "PostToolUse";
  /** Appended to what the model sees. Never replaces it. */
  additionalContext?: string;
  /** Replaces the tool result before the model sees it. */
  updatedToolOutput?: string;
}

/**
 * `continue: false` — stop the agent and tell the user why. The user must act to resume, which is
 * what makes this different from denying a single tool call.
 */
export function halt(reason: string): HookOutput {
  return { continue: false, stopReason: reason };
}

/** `continue: true` plus a warning the user sees. The agent carries on. */
export function warnUser(warning: string): HookOutput {
  return { continue: true, systemMessage: warning };
}

/** Permit a tool call, with a note for each audience. */
export function allow(agentMessage: string, userMessage: string): HookOutput {
  return decide("allow", agentMessage, userMessage);
}

/** Refuse a tool call. The model reads permissionDecisionReason, the developer systemMessage. */
export function deny(agentMessage: string, userMessage: string): HookOutput {
  return decide("deny", agentMessage, userMessage);
}

function decide(
  permissionDecision: "allow" | "deny",
  agentMessage: string,
  userMessage: string,
): HookOutput {
  const out: HookOutput = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision,
      permissionDecisionReason: agentMessage,
    },
  };
  // Omit an empty systemMessage rather than showing the user a blank warning line.
  if (userMessage) out.systemMessage = userMessage;
  return out;
}

export interface PostOptions {
  /** Make the feedback actionable — the model is expected to go back and fix what it just did. */
  warn?: boolean;
  /** Replace the tool's result before the model sees it. */
  replaceOutput?: string;
}

/**
 * PostToolUse feedback. The tool has already run, so nothing here can prevent it — `--warn` makes
 * the model treat the note as something to act on rather than something to read.
 *
 * The agent-facing message always goes in `additionalContext`, never in `reason`.
 */
export function post(
  agentMessage: string,
  userMessage: string,
  opts: PostOptions = {},
): HookOutput {
  const specific: PostToolUseOutput = { hookEventName: "PostToolUse" };
  if (agentMessage) specific.additionalContext = agentMessage;
  if (opts.replaceOutput !== undefined) specific.updatedToolOutput = opts.replaceOutput;

  const out: HookOutput = { hookSpecificOutput: specific };
  if (userMessage) out.systemMessage = userMessage;
  if (opts.warn) out.decision = "block";
  return out;
}

/**
 * Serialise for stdout. JSON.stringify handles every escape the hand-rolled json_escape in the
 * original shell library had to spell out — quotes, backslashes, newlines, tabs, control
 * characters — and cannot get them wrong.
 */
export function render(output: HookOutput): string {
  return `${JSON.stringify(output)}\n`;
}
