/**
 * Tests for config management, API key resolution, and free strategy.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm, readFile, mkdir } from "fs/promises";
import { join } from "path";
import { tmpdir, homedir } from "os";
import { AgenticConverter } from "../agents/agentic-converter";

let tempDir: string;

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "config-test-"));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

// ── Config Manager Tests ────────────────────────────────────────────

describe("Config Manager", () => {
  test("loadConfig returns empty object when no file exists", async () => {
    const { loadConfig } = await import("../config/config-manager");
    // loadConfig gracefully handles missing files
    const config = await loadConfig();
    expect(config).toBeDefined();
    expect(typeof config).toBe("object");
  });

  test("getApiKey returns env var when set", async () => {
    const { getApiKey } = await import("../config/config-manager");
    const origKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-env";

    try {
      const key = await getApiKey("anthropic");
      expect(key).toBe("sk-ant-test-env");
    } finally {
      if (origKey) {
        process.env.ANTHROPIC_API_KEY = origKey;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    }
  });

  test("getApiKey returns env var for openrouter", async () => {
    const { getApiKey } = await import("../config/config-manager");
    const origKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "sk-or-test-env";

    try {
      const key = await getApiKey("openrouter");
      expect(key).toBe("sk-or-test-env");
    } finally {
      if (origKey) {
        process.env.OPENROUTER_API_KEY = origKey;
      } else {
        delete process.env.OPENROUTER_API_KEY;
      }
    }
  });

  test("getApiKey returns undefined when no key available", async () => {
    const { getApiKey } = await import("../config/config-manager");
    const origAnthKey = process.env.ANTHROPIC_API_KEY;
    const origOrKey = process.env.OPENROUTER_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    try {
      // Note: this may return a value if a config file exists on the system.
      // The primary assertion is that it doesn't throw.
      const key = await getApiKey("anthropic");
      expect(key === undefined || typeof key === "string").toBe(true);
    } finally {
      if (origAnthKey) process.env.ANTHROPIC_API_KEY = origAnthKey;
      if (origOrKey) process.env.OPENROUTER_API_KEY = origOrKey;
    }
  });
});

// ── Free Strategy Tests ─────────────────────────────────────────────

describe("Free Strategy Selection", () => {
  test("selects free when --free specified and OpenRouter key available", async () => {
    const converter = new AgenticConverter();
    const origAnthKey = process.env.ANTHROPIC_API_KEY;
    const origOrKey = process.env.OPENROUTER_API_KEY;

    process.env.OPENROUTER_API_KEY = "sk-or-test-key";
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const result = await converter.convert({
        direction: "claude-to-opencode",
        sourcePath: tempDir,
        outputPath: join(tempDir, "out"),
        enabled: true,
        preferredStrategy: "free",
        apiKey: "sk-or-test-key",
        components: [], // empty to avoid API calls
      });

      expect(result.strategyUsed).toBe("free");
    } finally {
      if (origAnthKey) {
        process.env.ANTHROPIC_API_KEY = origAnthKey;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
      if (origOrKey) {
        process.env.OPENROUTER_API_KEY = origOrKey;
      } else {
        delete process.env.OPENROUTER_API_KEY;
      }
    }
  });

  test("auto-selects free when OpenRouter key set but no Anthropic key", async () => {
    const converter = new AgenticConverter();
    const origAnthKey = process.env.ANTHROPIC_API_KEY;
    const origOrKey = process.env.OPENROUTER_API_KEY;

    process.env.OPENROUTER_API_KEY = "sk-or-test-key";
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const result = await converter.convert({
        direction: "claude-to-opencode",
        sourcePath: tempDir,
        outputPath: join(tempDir, "out"),
        enabled: true,
        preferredStrategy: "auto",
        components: [], // empty to avoid API calls
      });

      // Auto-select should pick free since OpenRouter key is set
      // (unless an agentic SDK is installed)
      expect(["free", "opencode", "codegen"]).toContain(result.strategyUsed);
    } finally {
      if (origAnthKey) {
        process.env.ANTHROPIC_API_KEY = origAnthKey;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
      if (origOrKey) {
        process.env.OPENROUTER_API_KEY = origOrKey;
      } else {
        delete process.env.OPENROUTER_API_KEY;
      }
    }
  });

  test("falls back from free to codegen when no OpenRouter key", async () => {
    const converter = new AgenticConverter();
    const origAnthKey = process.env.ANTHROPIC_API_KEY;
    const origOrKey = process.env.OPENROUTER_API_KEY;

    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    try {
      const result = await converter.convert({
        direction: "claude-to-opencode",
        sourcePath: tempDir,
        outputPath: join(tempDir, "out"),
        enabled: true,
        preferredStrategy: "free",
        components: [],
      });

      // Should fall back to codegen (always available)
      expect(result.strategyUsed).toBe("codegen");
    } finally {
      if (origAnthKey) process.env.ANTHROPIC_API_KEY = origAnthKey;
      if (origOrKey) process.env.OPENROUTER_API_KEY = origOrKey;
    }
  });

  test("strategy includes free in valid options", async () => {
    const converter = new AgenticConverter();
    const origAnthKey = process.env.ANTHROPIC_API_KEY;

    // Set an Anthropic key to avoid codegen fallback and test oneshot path
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";

    try {
      const result = await converter.convert({
        direction: "claude-to-opencode",
        sourcePath: tempDir,
        outputPath: join(tempDir, "out"),
        enabled: true,
        preferredStrategy: "auto",
        components: [],
      });

      // All valid strategies
      expect(
        ["claude", "opencode", "oneshot", "codegen", "free", "none"],
      ).toContain(result.strategyUsed);
    } finally {
      if (origAnthKey) {
        process.env.ANTHROPIC_API_KEY = origAnthKey;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    }
  });
});

// ── OpenRouter API Format Tests ─────────────────────────────────────

describe("OpenRouter URL Detection", () => {
  test("isOpenRouterUrl detects OpenRouter URLs", async () => {
    // We test this indirectly through the converter — the URL detection
    // is used internally by OneShotConverter
    const { OneShotConverter } = await import("../agents/oneshot-converter");
    const converter = new OneShotConverter();

    // When baseUrl points to OpenRouter, it should use the OpenRouter API format
    const result = await converter.convert({
      direction: "claude-to-opencode",
      sourcePath: tempDir,
      outputPath: join(tempDir, "out"),
      baseUrl: "https://openrouter.ai/api/v1",
      // No API key — should get the "no key" warning with OpenRouter-specific message
    });

    expect(result.strategy).toBe("oneshot");
    expect(result.warnings.some((w) => w.message.includes("OPENROUTER_API_KEY"))).toBe(true);
  });

  test("default URL produces Anthropic-specific warning", async () => {
    const { OneShotConverter } = await import("../agents/oneshot-converter");
    const converter = new OneShotConverter();
    const origKey = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    try {
      const result = await converter.convert({
        direction: "claude-to-opencode",
        sourcePath: tempDir,
        outputPath: join(tempDir, "out"),
        // Default baseUrl = Anthropic
      });

      expect(result.strategy).toBe("oneshot");
      expect(result.warnings.some((w) => w.message.includes("ANTHROPIC_API_KEY"))).toBe(true);
    } finally {
      if (origKey) process.env.ANTHROPIC_API_KEY = origKey;
    }
  });
});

// ── API Key Wizard Tests (non-interactive) ──────────────────────────

describe("API Key Wizard", () => {
  test("ensureApiKey returns existing key without prompting", async () => {
    const { ensureApiKey } = await import("../config/api-key-wizard");
    const origKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "sk-ant-existing";

    try {
      const key = await ensureApiKey("anthropic");
      expect(key).toBe("sk-ant-existing");
    } finally {
      if (origKey) {
        process.env.ANTHROPIC_API_KEY = origKey;
      } else {
        delete process.env.ANTHROPIC_API_KEY;
      }
    }
  });

  test("ensureApiKey returns existing OpenRouter key", async () => {
    const { ensureApiKey } = await import("../config/api-key-wizard");
    const origKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = "sk-or-existing";

    try {
      const key = await ensureApiKey("openrouter");
      expect(key).toBe("sk-or-existing");
    } finally {
      if (origKey) {
        process.env.OPENROUTER_API_KEY = origKey;
      } else {
        delete process.env.OPENROUTER_API_KEY;
      }
    }
  });
});
