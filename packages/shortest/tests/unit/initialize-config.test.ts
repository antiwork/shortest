import fs from "fs/promises";
import path from "path";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

describe("initializeConfig", () => {
  const tempDir = path.join(process.cwd(), "temp-test-config");

  beforeEach(async () => {
    vi.resetModules();
    delete process.env.ANTHROPIC_API_KEY;
    await fs.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  test("loads TypeScript config file", async () => {
    await fs.writeFile(
      path.join(tempDir, "shortest.config.ts"),
      `
      export default {
        headless: true,
        baseUrl: "https://example.com",
        testPattern: ".*",
        ai: {
          provider: "anthropic",
          apiKey: "test-key",
        }
    }
      `,
    );

    const { initializeConfig } = await import("@/index");
    const config = await initializeConfig({ configDir: tempDir });
    expect(config).toEqual({
      headless: true,
      baseUrl: "https://example.com",
      browser: {},
      testPattern: ".*",
      ai: {
        provider: "anthropic",
        apiKey: "test-key",
        model: "claude-3-5-sonnet-20241022",
      },
      caching: {
        enabled: true,
      },
    });
  });

  test("loads JavaScript config file", async () => {
    await fs.writeFile(
      path.join(tempDir, "shortest.config.js"),
      `
      export default {
        headless: true,
        baseUrl: "https://example.com",
        testPattern: ".*",
        ai: {
          provider: "anthropic",
          apiKey: "test-key",
          model: "claude-3-5-sonnet-20241022",
        },
      }
      `,
    );

    const { initializeConfig } = await import("@/index");
    const config = await initializeConfig({ configDir: tempDir });
    expect(config).toEqual({
      headless: true,
      baseUrl: "https://example.com",
      browser: {},
      testPattern: ".*",
      ai: {
        provider: "anthropic",
        apiKey: "test-key",
        model: "claude-3-5-sonnet-20241022",
      },
      caching: {
        enabled: true,
      },
    });
  });

  test("throws when multiple config files exist", async () => {
    await fs.writeFile(
      path.join(tempDir, "shortest.config.ts"),
      `
      export default {
        headless: true,
        baseUrl: "https://example.com",
        testPattern: ".*",
        anthropicKey: "test-key",
      }
      `,
    );

    await fs.writeFile(
      path.join(tempDir, "shortest.config.js"),
      `
      export default {
        headless: true,
        baseUrl: "https://example.com",
        testPattern: ".*",
        anthropicKey: "test-key",
      }
      `,
    );

    const { initializeConfig } = await import("@/index");
    await expect(initializeConfig({ configDir: tempDir })).rejects.toThrow(
      "Multiple config files found",
    );
  });

  test("throws when no config file exists", async () => {
    const { initializeConfig } = await import("@/index");
    await expect(
      initializeConfig({ configDir: tempDir }),
    ).rejects.toMatchObject({
      name: "ConfigError",
      type: "no-config",
      message: "No config file found. Please create one.",
    });
  });

  describe("CLI options", async () => {
    beforeEach(async () => {
      await fs.writeFile(
        path.join(tempDir, "shortest.config.ts"),
        `
      export default {
        headless: true,
        baseUrl: "https://example.com",
        testPattern: ".*",
        ai: {
          provider: "anthropic",
          apiKey: "test-key",
        }
      }
      `,
      );
    });

    test("overwrites config options", async () => {
      const cliOptions = {
        headless: true,
        baseUrl: "https://other.example.com",
        testPattern: "custom-pattern/**/*.test.ts",
        noCache: true,
      };
      const { initializeConfig } = await import("@/index");
      const config = await initializeConfig({ cliOptions, configDir: tempDir });
      expect(config).toEqual({
        headless: true,
        baseUrl: "https://other.example.com",
        browser: {},
        testPattern: "custom-pattern/**/*.test.ts",
        ai: {
          provider: "anthropic",
          apiKey: "test-key",
          model: "claude-3-5-sonnet-20241022",
        },
        caching: {
          enabled: false,
        },
      });
    });
  });
});
