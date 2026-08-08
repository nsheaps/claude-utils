/**
 * `agent-hook` entry point.
 *
 * Compiled by scripts/build-cli.mjs (via `bun build --compile`) into the standalone native
 * executable bin/agent-hook, produced at build time and not committed to git.
 * All the behaviour lives in cli.ts so it can be tested without spawning a process.
 */

import { main } from "./cli.js";

process.exitCode = main(process.argv.slice(2), {
  stdout: process.stdout,
  stderr: process.stderr,
});
