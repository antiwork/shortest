import { describe, expect, it, beforeEach, vi } from "vitest";
import { LogConfig } from "./config";
import { getLogger } from "./index";

describe("logger singleton", () => {
  beforeEach(() => {
    // Reset the module to clear the singleton instance
    vi.resetModules();
  });

  it("creates new logger instance on first call", () => {
    const config: Partial<LogConfig> = { level: "debug" };
    const logger = getLogger(config);

    expect(logger.config.level).toBe("debug");
  });

  it("returns same instance on subsequent calls", () => {
    const firstLogger = getLogger();
    const secondLogger = getLogger({ level: "info" as const });

    expect(firstLogger).toBe(secondLogger);
  });

  it("ignores config on subsequent calls", () => {
    const firstLogger = getLogger({ level: "debug" as const });
    const secondLogger = getLogger({ level: "info" as const });

    expect(firstLogger.config.level).toBe("debug");
    expect(firstLogger).toBe(secondLogger);
  });
});
