/**
 * Resolving which plugin a command is acting on.
 *
 * Every `agent-plugin` subcommand except `settings get-all --all` is scoped to exactly one plugin.
 * The name comes from `--plugin <name>` or, failing that, the `AGENT_PLUGIN_NAME` environment
 * variable, which is what a Claude Code plugin's own hooks and scripts normally have set.
 *
 * There is deliberately no third fallback. A missing name is an error, never a guess: the two
 * things a guess could plausibly mean — "the current directory's plugin" and "all plugins" — are
 * both wrong in ways that are silent. Writing a setting under the wrong plugin's file, or reading
 * every plugin's settings when the caller meant one, both look like success.
 */

export class MissingPluginNameError extends Error {
  constructor(hint: string) {
    super(
      `Cannot determine which plugin to act on. Pass --plugin <name> or set AGENT_PLUGIN_NAME. ${hint}`,
    );
    this.name = "MissingPluginNameError";
  }
}

/** A plugin name has to be usable inside a filename, since settings are stored per plugin. */
const VALID_PLUGIN_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export class InvalidPluginNameError extends Error {
  constructor(name: string) {
    super(
      `Invalid plugin name ${JSON.stringify(name)}. ` +
        `Expected letters, digits, dot, underscore or hyphen, starting with a letter or digit.`,
    );
    this.name = "InvalidPluginNameError";
  }
}

export function validatePluginName(name: string): string {
  if (!VALID_PLUGIN_NAME.test(name)) {
    throw new InvalidPluginNameError(name);
  }
  return name;
}

/**
 * Resolve the plugin name from an already-parsed `--plugin` value and the environment.
 *
 * `hint` is appended to the error message so each subcommand can say what the caller most likely
 * meant to do, rather than repeating one generic sentence everywhere.
 */
export function resolvePluginName(
  fromFlag: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
  hint = "",
): string {
  const candidate = fromFlag ?? env.AGENT_PLUGIN_NAME;
  if (candidate === undefined || candidate.trim() === "") {
    throw new MissingPluginNameError(hint);
  }
  return validatePluginName(candidate.trim());
}
