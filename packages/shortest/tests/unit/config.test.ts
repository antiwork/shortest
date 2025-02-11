import { describe, test, expect, beforeEach } from "vitest";
import { parseConfig } from "@/utils/config";

describe("Config parsing", () => {
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

  test("throws when anthropicKey is missing from both config and env", () => {
    const config = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
    };
    expect(() => parseConfig(config)).toThrowError(
      "anthropicKey must be provided",
    );
  });
});
