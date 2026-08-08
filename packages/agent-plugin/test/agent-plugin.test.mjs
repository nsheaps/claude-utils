// Tests for agent-plugin.
//
// These drive the built, committed executable in bin/ as a subprocess rather than importing the
// TypeScript sources. That means every test exercises exactly the artifact Homebrew installs —
// shebang, bundling, argument parsing, exit codes and all — so a build that produces a broken
// executable fails here instead of passing a unit test and breaking on a user's machine. The nx
// `test` target depends on `build` so the artifact is always current.

import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const CLI = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "bin",
  "agent-plugin",
);

const tmpDirs = [];
after(() => {
  for (const dir of tmpDirs) rmSync(dir, { recursive: true, force: true });
});

/** A throwaway project directory with a .claude/ inside it. */
function project() {
  const dir = mkdtempSync(join(tmpdir(), "agent-plugin-test-"));
  tmpDirs.push(dir);
  mkdirSync(join(dir, ".claude"), { recursive: true });
  return dir;
}

/**
 * Run the CLI. `env` is added to a deliberately minimal base so a stray AGENT_PLUGIN_NAME or
 * logLevel in the developer's own shell cannot change a result.
 */
function run(args, { cwd, env = {} } = {}) {
  const result = spawnSync(CLI, args, {
    cwd,
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: process.env.HOME, NO_COLOR: "1", ...env },
  });
  return { code: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

const settingsPath = (dir, plugin, ext = "yaml") =>
  join(dir, ".claude", `settings.${plugin}.${ext}`);

describe("agent-plugin: usage", () => {
  it("prints help and exits 0 for --help", () => {
    const { code, stdout } = run(["--help"]);
    assert.equal(code, 0);
    assert.match(stdout, /Usage: agent-plugin/);
    assert.match(stdout, /ensure-dependency/);
  });

  it("exits 2 with help when given no command", () => {
    const { code, stdout } = run([]);
    assert.equal(code, 2);
    assert.match(stdout, /Usage: agent-plugin/);
  });

  it("rejects an unknown command", () => {
    const { code, stderr } = run(["frobnicate"], { env: { AGENT_PLUGIN_NAME: "p" } });
    assert.equal(code, 2);
    assert.match(stderr, /Unknown command/);
  });
});

describe("agent-plugin: plugin name resolution", () => {
  it("errors, rather than guessing, when no name is available", () => {
    const { code, stderr } = run(["log", "hello"], { cwd: project() });
    assert.notEqual(code, 0);
    assert.match(stderr, /--plugin/);
    assert.match(stderr, /AGENT_PLUGIN_NAME/);
  });

  it("takes the name from AGENT_PLUGIN_NAME", () => {
    const { code, stderr } = run(["log", "hello"], {
      cwd: project(),
      env: { AGENT_PLUGIN_NAME: "from-env" },
    });
    assert.equal(code, 0);
    assert.match(stderr, /\[from-env\] hello/);
  });

  it("lets --plugin win over AGENT_PLUGIN_NAME", () => {
    const { stderr } = run(["--plugin", "from-flag", "log", "hello"], {
      cwd: project(),
      env: { AGENT_PLUGIN_NAME: "from-env" },
    });
    assert.match(stderr, /\[from-flag\] hello/);
    assert.doesNotMatch(stderr, /from-env/);
  });

  it("rejects a name that would not be safe in a filename", () => {
    const { code, stderr } = run(["--plugin", "../escape", "log", "hi"], { cwd: project() });
    assert.notEqual(code, 0);
    assert.match(stderr, /Invalid plugin name/);
  });
});

describe("agent-plugin: logging", () => {
  const env = { AGENT_PLUGIN_NAME: "logger" };

  it("defaults bare `log` to info", () => {
    const { stderr } = run(["log", "plain message"], { cwd: project(), env });
    assert.match(stderr, /^INFO \[logger\] plain message$/m);
  });

  it("writes logs to stderr and nothing to stdout", () => {
    const { stdout, stderr } = run(["log-warn", "careful"], { cwd: project(), env });
    assert.equal(stdout, "");
    assert.match(stderr, /WARN \[logger\] careful/);
  });

  it("drops levels below the default info threshold", () => {
    const dir = project();
    assert.equal(run(["log-trace", "t"], { cwd: dir, env }).stderr, "");
    assert.equal(run(["log-debug", "d"], { cwd: dir, env }).stderr, "");
    assert.match(run(["log-error", "e"], { cwd: dir, env }).stderr, /ERROR \[logger\] e/);
  });

  it("honours AGENT_PLUGIN_LOG_LEVEL", () => {
    const { stderr } = run(["log-debug", "now visible"], {
      cwd: project(),
      env: { ...env, AGENT_PLUGIN_LOG_LEVEL: "debug" },
    });
    assert.match(stderr, /DEBUG \[logger\] now visible/);
  });

  it("honours the plugin's own logLevel setting", () => {
    const dir = project();
    writeFileSync(settingsPath(dir, "logger"), "logLevel: trace\n");
    const { stderr } = run(["log-trace", "deep"], { cwd: dir, env });
    assert.match(stderr, /TRACE \[logger\] deep/);
  });

  it("lets the environment override the setting", () => {
    const dir = project();
    writeFileSync(settingsPath(dir, "logger"), "logLevel: error\n");
    const { stderr } = run(["log-info", "shown anyway"], {
      cwd: dir,
      env: { ...env, AGENT_PLUGIN_LOG_LEVEL: "info" },
    });
    assert.match(stderr, /INFO \[logger\] shown anyway/);
  });

  it("joins a multi-word unquoted message instead of logging only the first word", () => {
    const { stderr } = run(["log", "one", "two", "three"], { cwd: project(), env });
    assert.match(stderr, /\[logger\] one two three/);
  });

  it("still logs when the settings file is unparseable", () => {
    const dir = project();
    writeFileSync(settingsPath(dir, "logger"), "this: [is: not: valid\n");
    const { code, stderr } = run(["log", "survived"], { cwd: dir, env });
    assert.equal(code, 0);
    assert.match(stderr, /\[logger\] survived/);
  });
});

describe("agent-plugin: settings read and write", () => {
  const env = { AGENT_PLUGIN_NAME: "demo" };

  it("creates a yaml file on first write and reads the value back", () => {
    const dir = project();
    assert.equal(run(["settings", "greeting", "hello"], { cwd: dir, env }).code, 0);
    const { code, stdout } = run(["settings", "greeting"], { cwd: dir, env });
    assert.equal(code, 0);
    assert.equal(stdout, "hello\n");
    assert.match(readFileSync(settingsPath(dir, "demo"), "utf8"), /greeting: hello/);
  });

  it("addresses nested keys with dots", () => {
    const dir = project();
    run(["settings", "a.b.c", "deep"], { cwd: dir, env });
    assert.equal(run(["settings", "a.b.c"], { cwd: dir, env }).stdout, "deep\n");
  });

  it("leaves unrelated keys and yaml comments untouched on write", () => {
    const dir = project();
    writeFileSync(
      settingsPath(dir, "demo"),
      "# a comment worth keeping\nkeep: me\nnested:\n  alsoKeep: yes\n",
    );
    run(["settings", "nested.added", "new"], { cwd: dir, env });
    const text = readFileSync(settingsPath(dir, "demo"), "utf8");
    assert.match(text, /# a comment worth keeping/);
    assert.match(text, /keep: me/);
    assert.match(text, /alsoKeep: yes/);
    assert.match(text, /added: new/);
  });

  it("coerces scalars the way the file would spell them", () => {
    const dir = project();
    run(["settings", "flag", "true"], { cwd: dir, env });
    run(["settings", "count", "42"], { cwd: dir, env });
    run(["settings", "name", "plain"], { cwd: dir, env });
    const text = readFileSync(settingsPath(dir, "demo"), "utf8");
    assert.match(text, /flag: true/);
    assert.match(text, /count: 42/);
    assert.match(text, /name: plain/);
  });

  it("lets quoting force a string", () => {
    const dir = project();
    run(["settings", "literal", "'true'"], { cwd: dir, env });
    const text = readFileSync(settingsPath(dir, "demo"), "utf8");
    // Serialised with quotes because it is the STRING "true", not the boolean.
    assert.match(text, /literal: ("true"|'true')/);
  });

  it("exits non-zero for a key that is not set", () => {
    const { code, stderr } = run(["settings", "nope"], { cwd: project(), env });
    assert.equal(code, 1);
    assert.match(stderr, /no such setting/);
  });

  it("reads an existing json settings file", () => {
    const dir = project();
    writeFileSync(settingsPath(dir, "demo", "json"), JSON.stringify({ a: { b: "json-value" } }));
    assert.equal(run(["settings", "a.b"], { cwd: dir, env }).stdout, "json-value\n");
  });

  it("writes into an existing json file without converting it to yaml", () => {
    const dir = project();
    const path = settingsPath(dir, "demo", "json");
    writeFileSync(path, JSON.stringify({ existing: "kept" }, null, 2));
    run(["settings", "added", "value"], { cwd: dir, env });
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    assert.deepEqual(parsed, { existing: "kept", added: "value" });
  });

  it("keeps each plugin's settings in its own file", () => {
    const dir = project();
    run(["--plugin", "one", "settings", "k", "v1"], { cwd: dir });
    run(["--plugin", "two", "settings", "k", "v2"], { cwd: dir });
    assert.equal(run(["--plugin", "one", "settings", "k"], { cwd: dir }).stdout, "v1\n");
    assert.equal(run(["--plugin", "two", "settings", "k"], { cwd: dir }).stdout, "v2\n");
  });
});

describe("agent-plugin: settings get-all", () => {
  it("flattens nested keys to the same dotted spelling reads accept", () => {
    const dir = project();
    writeFileSync(settingsPath(dir, "demo"), "top: 1\nnested:\n  inner: two\n");
    const { code, stdout } = run(["settings", "get-all"], {
      cwd: dir,
      env: { AGENT_PLUGIN_NAME: "demo" },
    });
    assert.equal(code, 0);
    assert.match(stdout, /^top=1$/m);
    assert.match(stdout, /^nested\.inner=two$/m);
  });

  it("errors instead of falling back to --all when no name is available", () => {
    const dir = project();
    writeFileSync(settingsPath(dir, "demo"), "top: 1\n");
    const { code, stdout, stderr } = run(["settings", "get-all"], { cwd: dir });
    assert.notEqual(code, 0);
    assert.equal(stdout, "");
    assert.match(stderr, /--all/);
    // The critical assertion: no plugin's settings leaked out despite one existing.
    assert.doesNotMatch(stderr, /top=1/);
  });

  it("works without a plugin name when --all is passed, grouped by plugin", () => {
    const dir = project();
    writeFileSync(settingsPath(dir, "alpha"), "a: 1\n");
    writeFileSync(settingsPath(dir, "beta", "json"), JSON.stringify({ b: 2 }));
    const { code, stdout } = run(["settings", "get-all", "--all"], { cwd: dir });
    assert.equal(code, 0);
    assert.match(stdout, /^# alpha$/m);
    assert.match(stdout, /^a=1$/m);
    assert.match(stdout, /^# beta$/m);
    assert.match(stdout, /^b=2$/m);
  });

  it("does not treat Claude Code's own settings files as plugins", () => {
    const dir = project();
    writeFileSync(join(dir, ".claude", "settings.json"), JSON.stringify({ model: "opus" }));
    writeFileSync(join(dir, ".claude", "settings.local.json"), JSON.stringify({ secret: "x" }));
    writeFileSync(settingsPath(dir, "real"), "mine: yes\n");
    const { stdout } = run(["settings", "get-all", "--all"], { cwd: dir });
    assert.match(stdout, /^# real$/m);
    assert.doesNotMatch(stdout, /# local/);
    assert.doesNotMatch(stdout, /secret/);
    assert.doesNotMatch(stdout, /model/);
  });

  it("rejects --all on anything other than get-all", () => {
    const { code, stderr } = run(["settings", "some.key", "--all"], { cwd: project() });
    assert.equal(code, 2);
    assert.match(stderr, /--all applies to/);
  });

  it("honours CLAUDE_PROJECT_DIR over the working directory", () => {
    const dir = project();
    writeFileSync(settingsPath(dir, "demo"), "fromProjectDir: yes\n");
    const { stdout } = run(["settings", "fromProjectDir"], {
      cwd: tmpdir(),
      env: { AGENT_PLUGIN_NAME: "demo", CLAUDE_PROJECT_DIR: dir },
    });
    assert.equal(stdout, "yes\n");
  });
});

describe("agent-plugin: ensure-dependency", () => {
  const env = { AGENT_PLUGIN_NAME: "deps" };

  it("succeeds quietly when the cli is already present", () => {
    const { code, stderr } = run(["ensure-dependency", "sh", "sh@latest"], {
      cwd: project(),
      env,
    });
    assert.equal(code, 0);
    // "already available" is a debug line, so it is suppressed at the default threshold.
    assert.equal(stderr, "");
  });

  it("reports it at debug level", () => {
    const { stderr } = run(["ensure-dependency", "sh", "sh@latest"], {
      cwd: project(),
      env: { ...env, AGENT_PLUGIN_LOG_LEVEL: "debug" },
    });
    assert.match(stderr, /DEBUG \[deps\] sh is already available/);
  });

  it("refuses to install when autoInstall is unset, and says how to enable it", () => {
    const { code, stderr } = run(["ensure-dependency", "definitely-not-a-real-cli-xyz", "nope@1"], {
      cwd: project(),
      env,
    });
    assert.equal(code, 1);
    assert.match(stderr, /is not installed/);
    assert.match(stderr, /mise use -g nope@1/);
    assert.match(stderr, /autoInstall true/);
  });

  it("reads autoInstall from the plugin's own settings, not from an argument", () => {
    const dir = project();
    writeFileSync(settingsPath(dir, "deps"), "autoInstall: true\n");
    // A PATH holding nothing but node, so mise cannot be found and this test never installs
    // anything. node itself has to stay reachable because the CLI's shebang is `env node` — which
    // is also why the Homebrew formula rewrites that shebang to an absolute path on install.
    const nodeOnly = join(dir, "node-only-bin");
    mkdirSync(nodeOnly, { recursive: true });
    symlinkSync(process.execPath, join(nodeOnly, "node"));

    const { code, stderr } = run(["ensure-dependency", "definitely-not-a-real-cli-xyz", "nope@1"], {
      cwd: dir,
      env: { ...env, PATH: nodeOnly },
    });
    assert.equal(code, 1);
    assert.match(stderr, /mise is not available/);
    // Proves it read the setting: the autoInstall-disabled branch never mentions mise being absent.
    assert.doesNotMatch(stderr, /autoInstall true/);
  });

  it("requires both a cli name and a mise package", () => {
    const { code, stderr } = run(["ensure-dependency", "gh"], { cwd: project(), env });
    assert.equal(code, 2);
    assert.match(stderr, /requires a cli name and a mise package/);
  });

  it("still needs a plugin name, for the log tag", () => {
    const { code, stderr } = run(["ensure-dependency", "gh", "gh@latest"], { cwd: project() });
    assert.notEqual(code, 0);
    assert.match(stderr, /AGENT_PLUGIN_NAME/);
  });
});
