import { describe, expect, it } from "vitest";
import { LogConfigSchema, LOG_LEVELS, LOG_FORMATS } from "./config";

describe("LogConfigSchema", () => {
  it("validates valid config", () => {
    const validConfig = {
      level: "debug" as const,
      format: "terminal" as const,
    };

    const result = LogConfigSchema.parse(validConfig);
    expect(result).toEqual(validConfig);
  });

  it("uses default values when not provided", () => {
    const result = LogConfigSchema.parse({});
    expect(result).toEqual({
      level: "silent",
      format: "terminal",
    });
  });

  it("throws on invalid level", () => {
    expect(() =>
      LogConfigSchema.parse({
        level: "invalid",
      }),
    ).toThrow();
  });

  it("throws on invalid format", () => {
    expect(() =>
      LogConfigSchema.parse({
        format: "invalid",
      }),
    ).toThrow();
  });

  it("contains correct log levels", () => {
    expect(LOG_LEVELS).toEqual([
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "silent",
    ]);
  });

  it("contains correct log formats", () => {
    expect(LOG_FORMATS).toEqual(["terminal", "pretty", "reporter"]);
  });
});
