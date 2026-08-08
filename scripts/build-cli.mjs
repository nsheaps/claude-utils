#!/usr/bin/env bun
// Compiles one workspace package's TypeScript entry point into a single, self-contained,
// native standalone executable at the repo root's bin/ directory, using `bun build --compile`.
//
// Run it with bun from inside the package being built (that is how the package's own `build`
// script invokes it):
//
//   bun ../../scripts/build-cli.mjs [--target=<bun-target>] [--outdir=<dir>]
//
// `bun build --compile` bundles the entry point, every dependency, and a copy of the Bun runtime
// into one file that runs with no Node.js, no Bun, and no node_modules alongside it. End users no
// longer need node at runtime. Because the artifact is self-contained and platform-specific, it is
// NO LONGER committed to git — it is produced at build time (locally via `mise run build`, and in
// CI for every release platform) and, for releases, uploaded to the GitHub release. The Homebrew
// formula installs the per-platform binary FROM the release asset.
//
// CLI arguments (parsed from process.argv):
//
//   --target=<bun-target>   Optional Bun compile target (e.g. bun-linux-x64, bun-darwin-arm64).
//                           When omitted, bun builds for the host platform. This is how the
//                           release cross-compiles all four platform binaries from one runner.
//   --outdir=<dir>          Optional output directory. Defaults to <repoRoot>/bin.
//
// For the package in the current working directory it runs, from that cwd:
//
//   bun build ./src/index.ts --compile [--target=<bun-target>] --outfile <outdir>/<cliName>
//
// Notes:
//   - `bun build --compile` emits an executable with the correct mode, so there is NO shebang
//     banner to inject and NO chmod to perform.
//   - `--outdir` is NOT a bun flag under --compile (bun rejects it); it is only an argument to
//     this script, which is translated into `--outfile <outdir>/<cliName>`.

import { execFileSync } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = process.cwd();

// --- parse args -------------------------------------------------------------------------------

/**
 * Reads a `--name=value` or `--name value` flag out of the argv list.
 * Returns undefined when the flag is absent.
 */
function readFlag(argv, name) {
  const prefix = `--${name}=`;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith(prefix)) {
      return arg.slice(prefix.length);
    }
    if (arg === `--${name}`) {
      return argv[i + 1];
    }
  }
  return undefined;
}

const argv = process.argv.slice(2);
const target = readFlag(argv, "target");
const outdir = readFlag(argv, "outdir") ?? join(repoRoot, "bin");

// --- derive the executable name ---------------------------------------------------------------

const pkg = JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8"));

// The CLI's on-disk name. Defaults to the package name so a package only has to set this when
// the executable is deliberately named something other than the directory it lives in.
const cliName = pkg.claudeUtilsCli ?? pkg.name;
if (!cliName || cliName.includes("/")) {
  throw new Error(
    `Cannot derive an executable name from package "${pkg.name}". ` +
      `Set "claudeUtilsCli" in its package.json to a plain name with no scope or slash.`,
  );
}

const outfile = join(outdir, cliName);
await mkdir(outdir, { recursive: true });

// --- compile ----------------------------------------------------------------------------------

const bunArgs = ["build", "./src/index.ts", "--compile"];
if (target) {
  bunArgs.push(`--target=${target}`);
}
bunArgs.push("--outfile", outfile);

// stdio inherited so bun's build errors surface directly to the caller (and to nx / mise).
execFileSync("bun", bunArgs, { cwd: packageRoot, stdio: "inherit" });

console.log(`built ${outfile}${target ? ` (target ${target})` : ""}`);
