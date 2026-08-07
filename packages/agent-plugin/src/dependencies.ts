/**
 * `ensure-dependency <cli> <mise-package>` — make sure a command-line tool a plugin needs is
 * available, installing it through mise if the plugin is allowed to.
 *
 * The caller never passes the opt-in. Whether to install is the plugin's own `autoInstall` setting,
 * read here, so every plugin that calls this honours the user's choice automatically and no plugin
 * can accidentally ship with auto-install hard-coded on. The plugin name is still required even
 * when nothing gets installed, because every line this logs is tagged with it.
 *
 * `autoInstall` defaults to false. Installing software is not something to do by default on the
 * strength of a plugin asking.
 */

import { spawnSync } from "node:child_process";
import type { Level } from "./log.js";
import type { JsonValue } from "./settings.js";

export type Outcome =
  | { status: "present"; cli: string }
  | { status: "installed"; cli: string; misePackage: string }
  | { status: "install-failed"; cli: string; misePackage: string; detail: string }
  | { status: "declined"; cli: string; misePackage: string }
  | { status: "no-mise"; cli: string; misePackage: string };

export interface EnsureDeps {
  /** Whether `cli` is already runnable. Injected so tests do not depend on the host's PATH. */
  hasCommand(cli: string): boolean;
  /** Runs a command, returning its exit status and combined output. */
  run(cmd: string, args: string[]): { code: number; output: string };
  autoInstall: boolean;
  log(level: Level, message: string): void;
}

/** Default `hasCommand`: resolve through the shell's own lookup rather than walking PATH by hand. */
export function commandExists(cli: string): boolean {
  // `command -v` is POSIX and, unlike `which`, is a shell builtin that reports functions and
  // builtins too. The name is passed as an argument, never interpolated into a shell string, so a
  // hostile value cannot become part of the command.
  const result = spawnSync("/bin/sh", ["-c", 'command -v "$1" >/dev/null 2>&1', "sh", cli], {
    stdio: "ignore",
  });
  return result.status === 0;
}

export function runCommand(cmd: string, args: string[]): { code: number; output: string } {
  const result = spawnSync(cmd, args, { encoding: "utf8" });
  if (result.error) return { code: 127, output: String(result.error.message) };
  return {
    code: result.status ?? 1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`.trim(),
  };
}

/** `autoInstall` is only true when it is literally the boolean true or the string "true". */
export function readAutoInstall(value: JsonValue | undefined): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return false;
}

export function ensureDependency(cli: string, misePackage: string, deps: EnsureDeps): Outcome {
  if (deps.hasCommand(cli)) {
    deps.log("debug", `${cli} is already available`);
    return { status: "present", cli };
  }

  if (!deps.autoInstall) {
    deps.log(
      "error",
      `${cli} is not installed. Install it with \`mise use -g ${misePackage}\`, or enable ` +
        `automatic installation with \`agent-plugin settings autoInstall true\`.`,
    );
    return { status: "declined", cli, misePackage };
  }

  if (!deps.hasCommand("mise")) {
    deps.log(
      "error",
      `${cli} is not installed and mise is not available to install it. ` +
        `Install mise (https://mise.jdx.dev) or install ${cli} yourself.`,
    );
    return { status: "no-mise", cli, misePackage };
  }

  deps.log("info", `${cli} is not installed — installing ${misePackage} with mise`);
  const { code, output } = deps.run("mise", ["use", "-g", misePackage]);
  if (code !== 0) {
    deps.log("error", `Failed to install ${misePackage} (mise exited ${code}): ${output}`);
    return { status: "install-failed", cli, misePackage, detail: output };
  }

  // mise puts the shim on PATH for future shells, but this process's PATH was fixed at exec time,
  // so a re-check here can legitimately still fail. Report the install as done and say so, rather
  // than calling a successful install a failure.
  if (!deps.hasCommand(cli)) {
    deps.log(
      "warn",
      `Installed ${misePackage}, but ${cli} is still not on this process's PATH. ` +
        `It should be available in a new shell, or via \`mise exec -- ${cli}\`.`,
    );
  } else {
    deps.log("info", `Installed ${misePackage}`);
  }
  return { status: "installed", cli, misePackage };
}
