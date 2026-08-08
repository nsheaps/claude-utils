#!/usr/bin/env node
// Bundles one workspace package's TypeScript entry point into a single, self-contained,
// extensionless executable at the repo root's bin/ directory.
//
// Run it from inside the package being built (that is how the package's own `build` script
// invokes it, mirroring the build-userscript.mjs pattern in nsheaps/greasemonkey-scripts):
//
//   node ../../scripts/build-cli.mjs
//
// The output is committed to the repo on purpose. The Homebrew formula installs from a release
// tarball and declares only `depends_on "node"` — it never runs yarn, tsc, or esbuild — so the
// runnable artifact has to already be in the tarball. Keeping it in bin/ also means the existing
// `bin.install Dir['bin/*']` line in the formula picks it up with no change.
//
// Two output choices matter and are not arbitrary:
//
//   format: 'cjs' — the output file has NO extension, and Node decides a file's module system
//     from its extension or the nearest package.json "type". An extensionless file has neither
//     once Homebrew has installed it to a bin/ directory with no package.json anywhere above it,
//     and Node's fallback for that is CommonJS. Emitting ESM would depend on Node's syntax
//     auto-detection, which is version-dependent. CommonJS runs identically everywhere.
//
//   bundle: true — every dependency is inlined, so the installed executable needs no
//     node_modules next to it. This is what lets the formula get away with a single dependency.

import { build } from "esbuild";
import { chmod, mkdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = process.cwd();

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

const outfile = join(repoRoot, "bin", cliName);
await mkdir(join(repoRoot, "bin"), { recursive: true });

await build({
  entryPoints: [join(packageRoot, "src", "index.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node22",
  // Keep the bundle readable. These are small CLIs installed on developer machines, not shipped
  // over a network, so a diffable artifact is worth more than a few saved kilobytes — and this
  // output is committed, so minifying it would make every dependency bump an unreadable diff.
  minify: false,
  banner: {
    js: [
      "#!/usr/bin/env node",
      "// GENERATED FILE — do not edit.",
      `// Built from packages/${cliName}/src by scripts/build-cli.mjs. Run \`mise run build\`.`,
    ].join("\n"),
  },
  logLevel: "info",
});

// Homebrew's `bin.install` preserves the mode bits it finds, and git only tracks the executable
// bit, so this has to be set here for the committed file to be runnable after checkout.
await chmod(outfile, 0o755);

console.log(`built bin/${cliName}`);
