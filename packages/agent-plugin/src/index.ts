/**
 * `agent-plugin` entry point.
 *
 * Bundled by scripts/build-cli.mjs into the committed, extensionless executable bin/agent-plugin.
 * All the behaviour lives in cli.ts so it can be tested without spawning a process.
 */

import { main } from "./cli.js";

process.exitCode = main(process.argv.slice(2), {
  stdout: process.stdout,
  stderr: process.stderr,
  env: process.env,
  cwd: process.cwd(),
});
