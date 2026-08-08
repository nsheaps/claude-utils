/**
 * Argument parsing and dispatch for `agent-hook`.
 *
 * Every command that emits a hook decision exits 0, including the ones that block. On exit 2 the
 * harness throws away stdout and reads stderr as the reason instead, so a non-zero exit here would
 * discard the very JSON the command exists to produce. The only non-zero exits are for the CLI's
 * own usage errors, which happen before any decision JSON is written.
 */

import { allow, deny, halt, post, render, warnUser } from "./output.js";
import { exportInput } from "./export-input.js";

export const HELP = `Usage: agent-hook <command> [args]

Emits the JSON a Claude Code hook answers with, on stdout. Every decision command exits 0 —
blocking is expressed in the JSON, never by the exit status, because on a non-zero exit the
harness discards stdout and reads stderr instead.

Reading the payload:
  export-input "$HOOK_INPUT"
      Print shell \`export\` lines for the hook's stdin payload. Use it as:

        HOOK_INPUT="$(cat)"
        eval "$(agent-hook export-input "$HOOK_INPUT")"

      Sets HOOK_EVENT_NAME, HOOK_SESSION_ID, HOOK_CWD, HOOK_TOOL_NAME, and one variable per
      scalar in nested objects (HOOK_TOOL_INPUT_COMMAND, HOOK_TOOL_INPUT_FILE_PATH, ...).
      Nested objects are also available whole as JSON, plus HOOK_INPUT_JSON for the lot.
      HOOK_EVENT_NAME is what you echo back as hookEventName.

Decisions (use with exec, so the hook's exit status is this command's):
  halt "<reason>"
      Stop the agent. continue:false + stopReason. The user must act to resume.

  warn-user "<warning>"
      Warn the user and carry on. continue:true + systemMessage.

  allow "<for agent>" "<for user>"
      Permit a tool call. PreToolUse permissionDecision:allow.

  deny "<for agent>" "<for user>"
      Refuse a tool call. PreToolUse permissionDecision:deny. The agent-facing message is where
      the alternative to suggest goes — the model reads it.

  post [--warn] [--replace-output "<new output>"] "<for agent>" "<for user>"
      PostToolUse feedback; the tool has already run. The agent-facing message always goes in
      additionalContext, never in reason.
        --warn             make it actionable (decision:block) rather than informational
        --replace-output   replace the tool result the model sees (updatedToolOutput)

Options:
  -h, --help               show this help
`;

export interface Io {
  stdout: { write(chunk: string): unknown };
  stderr: { write(chunk: string): unknown };
}

interface ParsedArgs {
  warn: boolean;
  replaceOutput?: string;
  help: boolean;
  positional: string[];
}

export function parseArgs(argv: string[]): ParsedArgs {
  const out: ParsedArgs = { warn: false, help: false, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--warn") {
      out.warn = true;
    } else if (a === "--replace-output") {
      const value = argv[++i];
      if (value === undefined) throw new Error("--replace-output requires a value");
      out.replaceOutput = value;
    } else if (a.startsWith("--replace-output=")) {
      out.replaceOutput = a.slice("--replace-output=".length);
    } else if (a === "-h" || a === "--help") {
      out.help = true;
    } else if (a === "--") {
      // Messages routinely start with a hyphen; everything after `--` is a positional.
      out.positional.push(...argv.slice(i + 1));
      break;
    } else {
      out.positional.push(a);
    }
  }
  return out;
}

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

  const [command, ...rest] = args.positional as [string, ...string[]];

  switch (command) {
    case "export-input":
      return doExportInput(rest, io);

    case "halt":
      return one(command, rest, io, (reason) => halt(reason));

    case "warn-user":
      return one(command, rest, io, (warning) => warnUser(warning));

    case "allow":
      return two(command, rest, io, (agentMsg, userMsg) => allow(agentMsg, userMsg));

    case "deny":
      return two(command, rest, io, (agentMsg, userMsg) => deny(agentMsg, userMsg));

    case "post":
      return two(command, rest, io, (agentMsg, userMsg) =>
        post(agentMsg, userMsg, { warn: args.warn, replaceOutput: args.replaceOutput }),
      );

    default:
      io.stderr.write(`ERROR: Unknown command ${JSON.stringify(command)}. Try --help.\n`);
      return 2;
  }
}

function errText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** A command taking exactly one message. */
function one(
  command: string,
  rest: string[],
  io: Io,
  build: (message: string) => ReturnType<typeof halt>,
): number {
  if (rest.length !== 1) {
    io.stderr.write(`ERROR: ${command} takes exactly one message. Quote it.\n`);
    return 2;
  }
  io.stdout.write(render(build(rest[0]!)));
  return 0;
}

/**
 * A command taking a message for the model and a message for the user.
 *
 * The second is optional: a decision that only needs to tell the model something should not force
 * the caller to invent a line for the user, which would then be shown as a warning.
 */
function two(
  command: string,
  rest: string[],
  io: Io,
  build: (agentMessage: string, userMessage: string) => ReturnType<typeof allow>,
): number {
  if (rest.length < 1 || rest.length > 2) {
    io.stderr.write(
      `ERROR: ${command} takes a message for the agent and, optionally, one for the user. Quote them.\n`,
    );
    return 2;
  }
  io.stdout.write(render(build(rest[0]!, rest[1] ?? "")));
  return 0;
}

function doExportInput(rest: string[], io: Io): number {
  if (rest.length !== 1) {
    io.stderr.write(
      `ERROR: export-input takes exactly one argument, the payload. ` +
        `Quote it: agent-hook export-input "$HOOK_INPUT"\n`,
    );
    return 2;
  }
  try {
    io.stdout.write(exportInput(rest[0]!));
  } catch (e) {
    // Nothing goes to stdout on failure, so `eval "$(...)"` evaluates an empty string rather than
    // a partial set of exports that would leave the hook reading stale or missing variables.
    io.stderr.write(`ERROR: ${errText(e)}\n`);
    return 1;
  }
  return 0;
}
