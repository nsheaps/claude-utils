// Tests for agent-hook.
//
// Like the agent-plugin tests, these drive the built, committed executable in bin/ as a subprocess,
// so what is asserted on is exactly the artifact Homebrew installs.
//
// The export-input tests deliberately go further and run the emitted text through a real shell,
// because the whole point of that command is that its output is safe to `eval`. Asserting on the
// generated string would only prove the string looks right; running it proves the shell agrees.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const CLI = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "bin", "agent-hook");

function run(args) {
  const r = spawnSync(CLI, args, { encoding: "utf8" });
  return { code: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

/** Run the CLI and parse its stdout as the hook JSON document. */
function json(args) {
  const { code, stdout } = run(args);
  assert.equal(code, 0, `expected exit 0, got ${code}`);
  return JSON.parse(stdout);
}

/**
 * eval the export-input output in a real bash, then print one variable, so an injection would show
 * up as either a changed value or an extra side effect.
 */
function evalAndRead(payload, varName, extraScript = "") {
  // The payload and the CLI path are handed to bash through the environment, never interpolated
  // into the script text. Quoting them into the script would mean this helper had its own escaping
  // bug surface, and a bug there could make an injection test pass for the wrong reason.
  const script = `
    set -u
    eval "$("$AGENT_HOOK_BIN" export-input "$HOOK_INPUT")"
    ${extraScript}
    printf '%s' "\${${varName}-<unset>}"
  `;
  const r = spawnSync("/bin/bash", ["-c", script], {
    encoding: "utf8",
    env: { ...process.env, AGENT_HOOK_BIN: CLI, HOOK_INPUT: payload },
  });
  return { code: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

describe("agent-hook: usage", () => {
  it("prints help and exits 0 for --help", () => {
    const { code, stdout } = run(["--help"]);
    assert.equal(code, 0);
    assert.match(stdout, /Usage: agent-hook/);
    assert.match(stdout, /export-input/);
  });

  it("exits 2 with help when given no command", () => {
    const { code, stdout } = run([]);
    assert.equal(code, 2);
    assert.match(stdout, /Usage: agent-hook/);
  });

  it("rejects an unknown command", () => {
    const { code, stderr } = run(["nope"]);
    assert.equal(code, 2);
    assert.match(stderr, /Unknown command/);
  });
});

describe("agent-hook: halt", () => {
  it("emits continue:false with stopReason", () => {
    const out = json(["halt", "too risky"]);
    assert.equal(out.continue, false);
    assert.equal(out.stopReason, "too risky");
  });

  it("exits 0 so the harness does not discard the JSON", () => {
    assert.equal(run(["halt", "x"]).code, 0);
  });

  it("requires exactly one message", () => {
    assert.equal(run(["halt"]).code, 2);
    assert.equal(run(["halt", "a", "b"]).code, 2);
  });
});

describe("agent-hook: warn-user", () => {
  it("emits continue:true with systemMessage", () => {
    const out = json(["warn-user", "heads up"]);
    assert.equal(out.continue, true);
    assert.equal(out.systemMessage, "heads up");
  });

  it("does not set stopReason", () => {
    assert.equal(json(["warn-user", "x"]).stopReason, undefined);
  });
});

describe("agent-hook: allow and deny", () => {
  it("allow uses the PreToolUse permission shape", () => {
    const out = json(["allow", "for the model", "for the human"]);
    assert.deepEqual(out.hookSpecificOutput, {
      hookEventName: "PreToolUse",
      permissionDecision: "allow",
      permissionDecisionReason: "for the model",
    });
    assert.equal(out.systemMessage, "for the human");
  });

  it("deny uses the same shape with permissionDecision deny", () => {
    const out = json(["deny", "use git switch instead", "blocked a checkout"]);
    assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
    assert.equal(out.hookSpecificOutput.permissionDecisionReason, "use git switch instead");
    assert.equal(out.systemMessage, "blocked a checkout");
  });

  it("never uses the legacy top-level decision/reason form for PreToolUse", () => {
    const out = json(["deny", "a", "b"]);
    assert.equal(out.decision, undefined);
    assert.equal(out.reason, undefined);
  });

  it("exits 0 even when denying", () => {
    assert.equal(run(["deny", "a", "b"]).code, 0);
  });

  it("omits systemMessage when no user message is given", () => {
    const out = json(["deny", "model only"]);
    assert.equal(out.systemMessage, undefined);
    assert.equal(out.hookSpecificOutput.permissionDecisionReason, "model only");
  });

  it("escapes quotes, newlines and backslashes in messages", () => {
    const nasty = 'he said "hi"\nline two\ttabbed \\ backslash';
    const out = json(["deny", nasty, "user"]);
    assert.equal(out.hookSpecificOutput.permissionDecisionReason, nasty);
  });
});

describe("agent-hook: post", () => {
  it("puts the agent message in additionalContext, never in reason", () => {
    const out = json(["post", "go fix it", "something was written"]);
    assert.equal(out.hookSpecificOutput.hookEventName, "PostToolUse");
    assert.equal(out.hookSpecificOutput.additionalContext, "go fix it");
    assert.equal(out.reason, undefined);
    assert.equal(out.systemMessage, "something was written");
  });

  it("is informational by default — no decision field", () => {
    assert.equal(json(["post", "fyi", "fyi"]).decision, undefined);
  });

  it("--warn makes it actionable via decision:block", () => {
    const out = json(["post", "--warn", "go fix it", "flagged"]);
    assert.equal(out.decision, "block");
    // Still additionalContext, not reason, even in the blocking form.
    assert.equal(out.hookSpecificOutput.additionalContext, "go fix it");
    assert.equal(out.reason, undefined);
  });

  it("--replace-output sets updatedToolOutput", () => {
    const out = json(["post", "--replace-output", "REDACTED", "note", "note"]);
    assert.equal(out.hookSpecificOutput.updatedToolOutput, "REDACTED");
  });

  it("--replace-output accepts an empty string, to blank the result", () => {
    const out = json(["post", "--replace-output", "", "note", "note"]);
    assert.equal(out.hookSpecificOutput.updatedToolOutput, "");
  });

  it("omits updatedToolOutput entirely when --replace-output is absent", () => {
    assert.ok(!("updatedToolOutput" in json(["post", "a", "b"]).hookSpecificOutput));
  });

  it("combines --warn and --replace-output", () => {
    const out = json(["post", "--warn", "--replace-output", "new", "agent", "user"]);
    assert.equal(out.decision, "block");
    assert.equal(out.hookSpecificOutput.updatedToolOutput, "new");
    assert.equal(out.hookSpecificOutput.additionalContext, "agent");
  });

  it("rejects --replace-output with no value", () => {
    const { code, stderr } = run(["post", "a", "b", "--replace-output"]);
    assert.equal(code, 2);
    assert.match(stderr, /requires a value/);
  });

  it("treats everything after -- as a message, so a leading hyphen is safe", () => {
    const out = json(["post", "--", "--warn is part of my message", "user"]);
    assert.equal(out.hookSpecificOutput.additionalContext, "--warn is part of my message");
    assert.equal(out.decision, undefined);
  });
});

describe("agent-hook: export-input", () => {
  const payload = JSON.stringify({
    session_id: "abc123",
    transcript_path: "/tmp/t.jsonl",
    cwd: "/repo",
    hook_event_name: "PreToolUse",
    permission_mode: "default",
    tool_name: "Bash",
    tool_input: { command: "git status", description: "check state" },
  });

  it("exports the common scalar fields", () => {
    const { stdout } = run(["export-input", payload]);
    assert.match(stdout, /^export HOOK_SESSION_ID='abc123'$/m);
    assert.match(stdout, /^export HOOK_CWD='\/repo'$/m);
    assert.match(stdout, /^export HOOK_TOOL_NAME='Bash'$/m);
  });

  it("names the event variable HOOK_EVENT_NAME, not HOOK_HOOK_EVENT_NAME", () => {
    const { stdout } = run(["export-input", payload]);
    assert.match(stdout, /^export HOOK_EVENT_NAME='PreToolUse'$/m);
    assert.doesNotMatch(stdout, /HOOK_HOOK_EVENT_NAME/);
  });

  it("flattens nested objects into one variable per scalar", () => {
    assert.equal(evalAndRead(payload, "HOOK_TOOL_INPUT_COMMAND").stdout, "git status");
  });

  it("also exports nested objects whole, as JSON", () => {
    const { stdout } = evalAndRead(payload, "HOOK_TOOL_INPUT");
    assert.deepEqual(JSON.parse(stdout), { command: "git status", description: "check state" });
  });

  it("exports the whole payload as HOOK_INPUT_JSON", () => {
    const { stdout } = evalAndRead(payload, "HOOK_INPUT_JSON");
    assert.equal(JSON.parse(stdout).tool_name, "Bash");
  });

  it("actually evaluates in a real shell", () => {
    const { code, stdout } = evalAndRead(payload, "HOOK_EVENT_NAME");
    assert.equal(code, 0);
    assert.equal(stdout, "PreToolUse");
  });

  it("converts camelCase keys to underscored names", () => {
    const p = JSON.stringify({ toolName: "Edit", filePath: "/a/b" });
    assert.equal(evalAndRead(p, "HOOK_TOOL_NAME").stdout, "Edit");
    assert.equal(evalAndRead(p, "HOOK_FILE_PATH").stdout, "/a/b");
  });

  it("represents booleans, numbers and null in a shell-usable way", () => {
    const p = JSON.stringify({ stop_hook_active: true, count: 3, nothing: null });
    assert.equal(evalAndRead(p, "HOOK_STOP_HOOK_ACTIVE").stdout, "true");
    assert.equal(evalAndRead(p, "HOOK_COUNT").stdout, "3");
    assert.equal(evalAndRead(p, "HOOK_NOTHING").stdout, "");
  });

  it("fails without writing partial exports when the payload is not JSON", () => {
    const { code, stdout, stderr } = run(["export-input", "not json at all"]);
    assert.equal(code, 1);
    assert.equal(stdout, "");
    assert.match(stderr, /Could not read the hook payload/);
  });

  it("rejects a JSON array at the top level", () => {
    const { code, stderr } = run(["export-input", "[1,2]"]);
    assert.equal(code, 1);
    assert.match(stderr, /expected a JSON object/);
  });

  it("requires exactly one argument", () => {
    assert.equal(run(["export-input"]).code, 2);
    assert.equal(run(["export-input", "{}", "{}"]).code, 2);
  });
});

describe("agent-hook: export-input is safe to eval", () => {
  it("neutralises a command substitution in a value", () => {
    const p = JSON.stringify({ prompt: "$(touch /tmp/agent-hook-pwned) `id` ${HOME}" });
    const { stdout } = evalAndRead(p, "HOOK_PROMPT");
    // The value survives as literal text: nothing was executed or expanded.
    assert.equal(stdout, "$(touch /tmp/agent-hook-pwned) `id` ${HOME}");
  });

  it("neutralises a value that tries to close its own quoting", () => {
    const p = JSON.stringify({ prompt: `'; echo INJECTED; echo '` });
    const { code, stdout } = evalAndRead(p, "HOOK_PROMPT");
    assert.equal(code, 0);
    assert.equal(stdout, `'; echo INJECTED; echo '`);
    assert.doesNotMatch(stdout, /INJECTED\n/);
  });

  it("does not let a value define another variable", () => {
    const p = JSON.stringify({ prompt: `x'\nexport SNEAKY=yes\n:'` });
    const { stdout } = evalAndRead(p, "SNEAKY");
    assert.equal(stdout, "<unset>");
  });

  it("strips metacharacters out of a hostile key instead of quoting it", () => {
    // A key cannot be protected by quoting — it is the left-hand side of an assignment — so the
    // metacharacters are removed rather than escaped, and the surrounding keys still work.
    const p = JSON.stringify({ "a; echo INJECTED; b": "v", safe_key: "kept" });
    const { code, stdout, stderr } = evalAndRead(p, "HOOK_SAFE_KEY");
    assert.equal(code, 0);
    assert.equal(stdout, "kept");
    assert.doesNotMatch(stderr, /INJECTED/);
  });

  it("renders a hostile key as a plain identifier, with the metacharacters gone", () => {
    const p = JSON.stringify({ "a; echo INJECTED; b": "v" });
    const { stdout } = run(["export-input", p]);
    assert.match(stdout, /^export HOOK_A_ECHO_INJECTED_B='v'$/m);
    // Every emitted assignment target is a bare identifier: no line has a metacharacter left of the =.
    for (const line of stdout.trim().split("\n")) {
      assert.match(line, /^export [A-Z_][A-Z0-9_]*=/);
    }
  });

  it("keeps newlines and single quotes in a value intact", () => {
    const p = JSON.stringify({ prompt: "line one\nline 'two'\nline three" });
    assert.equal(evalAndRead(p, "HOOK_PROMPT").stdout, "line one\nline 'two'\nline three");
  });

  it("survives a value made only of quotes and backslashes", () => {
    const p = JSON.stringify({ prompt: `'"'"'\\\\'` });
    const { code, stdout } = evalAndRead(p, "HOOK_PROMPT");
    assert.equal(code, 0);
    assert.equal(stdout, `'"'"'\\\\'`);
  });
});
