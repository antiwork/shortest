import { describe, test, expect, beforeEach } from "vitest";
import { validateConfig } from "../src/types/config";

describe("Config Validation", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  test("validates correct config", () => {
    const config = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
      anthropicKey: "test-key",
    };
    expect(() => validateConfig(config)).not.toThrow();
  });

  test("throws on invalid URL", () => {
    const config = {
      headless: true,
      baseUrl: "not-a-url",
      testPattern: ".*",
      anthropicKey: "test",
    };
    expect(() => validateConfig(config)).toThrowError(
      "baseUrl must be a valid URL",
    );
  });

  test("throws on invalid regex", () => {
    const config = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: "[", // invalid regex
      anthropicKey: "test",
    };
    expect(() => validateConfig(config)).toThrowError(
      "testPattern must be a valid regular expression",
    );
  });

  test("throws when mailosaur config is incomplete", () => {
    const config = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
      anthropicKey: "test",
      mailosaur: { apiKey: "key" }, // missing serverId
    };
    expect(() => validateConfig(config)).toThrowError("Required");
  });

  test("accepts config when anthropicKey is in env", () => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    const config = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
    };
    expect(() => validateConfig(config)).not.toThrow();
  });

  test("throws when anthropicKey is missing from both config and env", () => {
    const config = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
    };
    expect(() => validateConfig(config)).toThrowError(
      "anthropicKey must be provided",
    );
  });
});
