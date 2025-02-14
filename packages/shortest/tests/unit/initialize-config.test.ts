import fs from "fs/promises";
import path from "path";
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

describe("initializeConfig", () => {
  const tempDir = path.join(process.cwd(), "temp-test-config");

  beforeEach(async () => {
    vi.resetModules();
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.SHORTEST_ANTHROPIC_API_KEY;
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
        },
      }
      `,
    );

    const { initializeConfig } = await import("@/index");
    const config = await initializeConfig(tempDir);
    expect(config).toEqual({
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
      ai: {
        provider: "anthropic",
        apiKey: "test-key",
      },
    });
  });

  test("loads JavaScript config file", async () => {
    await fs.writeFile(
      path.join(tempDir, "shortest.config.js"),
      `
      export default {
        headless: true,
        baseUrl: 'https://example.com',
        testPattern: '.*',
        ai: {
          provider: 'anthropic',
          apiKey: 'test-key',
        },
      }
      `,
    );

    const { initializeConfig } = await import("@/index");
    const config = await initializeConfig(tempDir);
    expect(config).toEqual({
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
      ai: {
        provider: "anthropic",
        apiKey: "test-key",
      },
    });
  });

  test("prefers env SHORTEST_ANTHROPIC_API_KEY over config key", async () => {
    process.env.SHORTEST_ANTHROPIC_API_KEY = "env-key";

    await fs.writeFile(
      path.join(tempDir, "shortest.config.ts"),
      `
      export default {
        headless: true,
        baseUrl: 'https://example.com',
        testPattern: '.*',
        ai: {
          provider: 'anthropic',
          apiKey: 'config-key',
        },
      }
      `,
    );

    const { initializeConfig } = await import("@/index");
    const config = await initializeConfig(tempDir);
    expect(config?.ai?.apiKey).toBe("env-key");
  });

  test("prefers SHORTEST_ANTHROPIC_API_KEY over ANTHROPIC_API_KEY", async () => {
    process.env.SHORTEST_ANTHROPIC_API_KEY = "shortest-key";
    process.env.ANTHROPIC_API_KEY = "anthropic-key";

    await fs.writeFile(
      path.join(tempDir, "shortest.config.ts"),
      `
      export default {
        headless: true,
        baseUrl: 'https://example.com',
        testPattern: '.*',
        ai: {
          provider: 'anthropic',
        },
      }
      `,
    );

    const { initializeConfig } = await import("@/index");
    const config = await initializeConfig(tempDir);
    expect(config?.ai?.apiKey).toBe("shortest-key");
  });

  test("throws when multiple config files exist", async () => {
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
        },
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
        ai: {
          provider: "anthropic",
          apiKey: "test-key",
        },
      }
      `,
    );

    const { initializeConfig } = await import("@/index");
    await expect(initializeConfig(tempDir)).rejects.toThrow(
      "Multiple config files found"
    );
  });

  test("throws when no config file exists", async () => {
    const { initializeConfig } = await import("@/index");
    await expect(initializeConfig(tempDir)).rejects.toMatchObject({
      name: "ConfigError",
      type: "no-config",
      message: "No config file found. Please create one.",
    });
  });
});
