/**
 * Interactive API key setup wizard.
 *
 * When an API key is needed but not set, this module guides the user
 * through obtaining one and saves it to the config file.
 */

import { createInterface } from "readline";
import type { ApiProvider } from "./config-manager";
import { setApiKey, getApiKey } from "./config-manager";

// ── Provider Info ────────────────────────────────────────────────────

interface ProviderInfo {
  name: string;
  keyPrefix: string;
  signupUrl: string;
  keysUrl: string;
  instructions: string;
}

const PROVIDERS: Record<ApiProvider, ProviderInfo> = {
  anthropic: {
    name: "Anthropic",
    keyPrefix: "sk-ant-",
    signupUrl: "https://console.anthropic.com",
    keysUrl: "https://console.anthropic.com/settings/keys",
    instructions: `To get an Anthropic API key:
  1. Go to https://console.anthropic.com
  2. Sign up or log in
  3. Navigate to Settings > API Keys
  4. Create a new API key`,
  },
  openrouter: {
    name: "OpenRouter",
    keyPrefix: "sk-or-",
    signupUrl: "https://openrouter.ai",
    keysUrl: "https://openrouter.ai/settings/keys",
    instructions: `To get an OpenRouter API key (free tier available):
  1. Go to https://openrouter.ai
  2. Sign up or log in (GitHub/Google sign-in available)
  3. Navigate to Settings > Keys
  4. Create a new API key

  OpenRouter offers free models — no payment method required!`,
  },
};

// ── Readline Helper ──────────────────────────────────────────────────

function prompt(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stderr, // Use stderr so stdout stays clean for JSON output
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── Wizard ───────────────────────────────────────────────────────────

/**
 * Check if an API key is available for the given provider.
 * If not, guide the user through setup.
 *
 * Returns the API key if available (existing or newly entered),
 * or undefined if the user declines.
 */
export async function ensureApiKey(provider: ApiProvider): Promise<string | undefined> {
  // Check if key already exists
  const existing = await getApiKey(provider);
  if (existing) return existing;

  // Run the interactive wizard
  return runWizard(provider);
}

/**
 * Run the interactive API key wizard for a provider.
 */
export async function runWizard(provider: ApiProvider): Promise<string | undefined> {
  const info = PROVIDERS[provider];

  console.error(""); // blank line
  console.error(`  ${info.name} API Key Required`);
  console.error("  " + "=".repeat(30));
  console.error("");
  console.error(info.instructions);
  console.error("");

  const key = await prompt(`  Paste your ${info.name} API key (or press Enter to skip): `);

  if (!key) {
    console.error("");
    console.error("  Skipped. You can set this later with:");
    if (provider === "anthropic") {
      console.error("    export ANTHROPIC_API_KEY=sk-ant-...");
    } else {
      console.error("    export OPENROUTER_API_KEY=sk-or-...");
    }
    console.error("  Or run: plugin-convert setup");
    console.error("");
    return undefined;
  }

  // Validate key format
  if (info.keyPrefix && !key.startsWith(info.keyPrefix)) {
    console.error("");
    console.error(`  Warning: Key doesn't start with "${info.keyPrefix}".`);
    const confirm = await prompt("  Save anyway? (y/N): ");
    if (confirm.toLowerCase() !== "y") {
      console.error("  Key not saved.");
      return undefined;
    }
  }

  // Save to config
  await setApiKey(provider, key);
  console.error("");
  console.error(`  API key saved to ~/.config/plugin-convert/config.json`);
  console.error("");

  return key;
}

/**
 * Run the full setup wizard for all providers.
 */
export async function runFullSetup(): Promise<void> {
  console.error("");
  console.error("  plugin-convert Setup");
  console.error("  " + "=".repeat(20));
  console.error("");
  console.error("  Configure API keys for AI-powered conversion strategies.");
  console.error("");

  // Anthropic
  const anthropicKey = await getApiKey("anthropic");
  if (anthropicKey) {
    console.error(`  Anthropic API key: configured (${anthropicKey.slice(0, 12)}...)`);
    const update = await prompt("  Update? (y/N): ");
    if (update.toLowerCase() === "y") {
      await runWizard("anthropic");
    }
  } else {
    console.error("  Anthropic API key: not configured");
    const setup = await prompt("  Set up now? (Y/n): ");
    if (setup.toLowerCase() !== "n") {
      await runWizard("anthropic");
    }
  }

  console.error("");

  // OpenRouter
  const openrouterKey = await getApiKey("openrouter");
  if (openrouterKey) {
    console.error(`  OpenRouter API key: configured (${openrouterKey.slice(0, 12)}...)`);
    const update = await prompt("  Update? (y/N): ");
    if (update.toLowerCase() === "y") {
      await runWizard("openrouter");
    }
  } else {
    console.error("  OpenRouter API key: not configured");
    const setup = await prompt("  Set up now? (Y/n): ");
    if (setup.toLowerCase() !== "n") {
      await runWizard("openrouter");
    }
  }

  console.error("");
  console.error("  Setup complete!");
  console.error("");
}
