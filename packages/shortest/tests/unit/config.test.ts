import { describe, test, expect, beforeEach } from "vitest";
import { parseConfig } from "@/utils/config";

describe("Config parsing", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.SHORTEST_ANTHROPIC_API_KEY;
  });

  test("validates correct config", () => {
    const config = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
      ai: {
        provider: "anthropic",
        apiKey: "test-key",
      },
    };
    expect(() => parseConfig(config)).not.toThrow();
  });

  test("throws on invalid baseUrl", () => {
    const config = {
      headless: true,
      baseUrl: "not-a-url",
      testPattern: ".*",
      ai: {
        provider: "anthropic",
        apiKey: "test-key",
      },
    };
    expect(() => parseConfig(config)).toThrowError("must be a valid URL");
  });

  test("throws on invalid testPattern", () => {
    const config = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: null,
      ai: {
        provider: "anthropic",
        apiKey: "test-key",
      },
    };
    expect(() => parseConfig(config)).toThrowError(
      "Expected string, received null",
    );
  });

  test("throws when Mailosaur config is incomplete", () => {
    const config = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
      ai: {
        provider: "anthropic",
        apiKey: "test-key",
      },
      mailosaur: { apiKey: "key" }, // missing serverId
    };
    expect(() => parseConfig(config)).toThrowError("Required");
  });

  test("accepts config when API key is in env", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const config = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
      ai: {
        provider: "anthropic",
      },
    };
    expect(() => parseConfig(config)).not.toThrow();
  });

  test("accepts config when API key is in SHORTEST_ANTHROPIC_API_KEY", () => {
    process.env.SHORTEST_ANTHROPIC_API_KEY = "test-key";
    const config = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
      ai: {
        provider: "anthropic",
      },
    };
    expect(() => parseConfig(config)).not.toThrow();
  });

  test("throws when API key is missing from both config and env", () => {
    const config = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
      ai: {
        provider: "anthropic",
      },
    };
    expect(() => parseConfig(config)).toThrowError(
      "For provider 'anthropic', an API key must be provided in config or via environment variables.",
    );
  });
});
