/**
 * Config file management for plugin-convert.
 *
 * Stores API keys and preferences in ~/.config/plugin-convert/config.json
 * so users don't need to set environment variables or pass flags every time.
 */

import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { homedir } from "os";

// ── Config Schema ────────────────────────────────────────────────────

export interface PluginConvertConfig {
  /** Anthropic API key for one-shot strategy */
  anthropicApiKey?: string;
  /** OpenRouter API key for free tier */
  openrouterApiKey?: string;
  /** Default conversion strategy */
  defaultStrategy?: string;
  /** Default model for AI strategies */
  defaultModel?: string;
}

// ── Config Path ──────────────────────────────────────────────────────

function getConfigDir(): string {
  return join(homedir(), ".config", "plugin-convert");
}

function getConfigPath(): string {
  return join(getConfigDir(), "config.json");
}

// ── Load / Save ──────────────────────────────────────────────────────

/**
 * Load the config from disk. Returns empty config if file doesn't exist.
 */
export async function loadConfig(): Promise<PluginConvertConfig> {
  try {
    const content = await readFile(getConfigPath(), "utf-8");
    return JSON.parse(content) as PluginConvertConfig;
  } catch {
    return {};
  }
}

/**
 * Save the config to disk. Creates the directory if needed.
 */
export async function saveConfig(config: PluginConvertConfig): Promise<void> {
  await mkdir(getConfigDir(), { recursive: true });
  await writeFile(getConfigPath(), JSON.stringify(config, null, 2) + "\n");
}

// ── API Key Accessors ────────────────────────────────────────────────

export type ApiProvider = "anthropic" | "openrouter";

/**
 * Get an API key for the given provider.
 * Priority: env var > config file > undefined
 */
export async function getApiKey(provider: ApiProvider): Promise<string | undefined> {
  // Check environment variables first
  if (provider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }
  if (provider === "openrouter" && process.env.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY;
  }

  // Check config file
  const config = await loadConfig();
  if (provider === "anthropic") return config.anthropicApiKey;
  if (provider === "openrouter") return config.openrouterApiKey;

  return undefined;
}

/**
 * Save an API key for the given provider to the config file.
 */
export async function setApiKey(provider: ApiProvider, key: string): Promise<void> {
  const config = await loadConfig();
  if (provider === "anthropic") {
    config.anthropicApiKey = key;
  } else if (provider === "openrouter") {
    config.openrouterApiKey = key;
  }
  await saveConfig(config);
}
