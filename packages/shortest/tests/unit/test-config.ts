import { describe, test, expect, beforeEach } from "vitest";
import { LLMSupportedModels, LLMSupportedProviders } from "@/types";
import { parseConfig } from "@/utils/config";

describe("Config parsing", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  test("validates correct config with legacy anthropicKey", () => {
    const config = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
      anthropicKey: "test-key",
    };
    expect(() => parseConfig(config)).not.toThrow();
  });

  test("validates correct config with AI configuration", () => {
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
      anthropicKey: "test",
    };
    expect(() => parseConfig(config)).toThrowError("must be a valid URL");
  });

  test("throws on invalid testPattern", () => {
    const config = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: null,
      anthropicKey: "test",
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
      anthropicKey: "test",
      mailosaur: { apiKey: "key" }, // missing serverId
    };
    expect(() => parseConfig(config)).toThrowError("Required");
  });

  test("accepts config when anthropicKey is in env", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const config = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
    };
    expect(() => parseConfig(config)).not.toThrow();
  });

  test("throws when neither anthropicKey nor ai configuration is provided", () => {
    const config = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
    };
    expect(() => parseConfig(config)).toThrowError(
      "No AI configuration provided. Please provide either 'ai' or the legacy 'anthropicKey",
    );
  });

  test("throws when both anthropicKey and ai configurations are provided", () => {
    const config = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
      anthropicKey: "test-key",
      ai: {
        provider: "anthropic",
        apiKey: "test-key",
      },
    };
    expect(() => parseConfig(config)).toThrowError(
      "Both 'ai' and legacy 'anthropicKey' are provided. Please use only one.",
    );
  });

  test("transforms legacy anthropicKey into new AI object", () => {
    const apiKey = "testKey";
    const config = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
      anthropicKey: apiKey,
    };

    const expectedConfig = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
      ai: {
        provider: LLMSupportedProviders.ANTHROPIC,
        apiKey,
        model: LLMSupportedModels.CLAUDE_3_5_SONNET, // defaults to CLAUDE_3_5_SONNET automatically
      },
    };

    expect(parseConfig(config)).toEqual(expectedConfig);
  });
});
