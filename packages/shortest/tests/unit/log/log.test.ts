import { describe, expect, it, vi, beforeEach } from "vitest";
import { Log } from "@/log/log";
import { LogOutput } from "@/log/output";

vi.mock("@/log/output", () => ({
  LogOutput: {
    render: vi.fn(),
  },
}));

describe("Log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("configuration", () => {
    it("uses default config when none provided", () => {
      const log = new Log();
      expect(log.config).toEqual({
        level: "silent",
        format: "terminal",
      });
    });

    it("merges provided config with defaults", () => {
      const log = new Log({ level: "debug" });
      expect(log.config).toEqual({
        level: "debug",
        format: "terminal",
      });
    });
  });

  describe("log level filtering", () => {
    it("skips logs below configured level", () => {
      const log = new Log({ level: "info" });
      log.debug("test message");
      expect(LogOutput.render).not.toHaveBeenCalled();
    });

    it("outputs logs at or above configured level", () => {
      const log = new Log({ level: "info" });
      log.error("error message");
      log.warn("warn message");
      log.info("info message");
      expect(LogOutput.render).toHaveBeenCalledTimes(3);
    });
  });

  describe("log methods", () => {
    let log: Log;

    beforeEach(() => {
      log = new Log({ level: "trace" });
    });

    it.each([
      ["trace", "trace message"],
      ["debug", "debug message"],
      ["info", "info message"],
      ["warn", "warn message"],
      ["error", "error message"],
    ])("logs %s level messages", (level, message) => {
      (log as any)[level](message);
      expect(LogOutput.render).toHaveBeenCalledWith(
        expect.objectContaining({
          level,
          message,
        }),
        "terminal",
        undefined,
      );
    });

    it("handles multiple arguments", () => {
      log.info("Hello", "World", 123);
      expect(LogOutput.render).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Hello World 123",
        }),
        "terminal",
        undefined,
      );
    });

    it("handles metadata object", () => {
      const metadata = { userId: 123 };
      log.info("User logged in", metadata);
      expect(LogOutput.render).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "User logged in",
          metadata,
        }),
        "terminal",
        undefined,
      );
    });

    it("shows warnings even when below configured level", () => {
      const log = new Log({ level: "error" });
      const consoleSpy = vi.spyOn(console, "warn");

      log.warn("important warning");

      expect(LogOutput.render).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(" WARN "),
        expect.stringContaining("important warning"),
      );
    });

    it("handles multiple arguments with metadata", () => {
      log.info("User", "action", "completed", { userId: 123, action: "login" });
      expect(LogOutput.render).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "User action completed",
          metadata: { userId: 123, action: "login" },
        }),
        "terminal",
        undefined,
      );
    });

    it("handles undefined and null arguments", () => {
      log.info(undefined, null, "message");
      expect(LogOutput.render).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "undefined null message",
        }),
        "terminal",
        undefined,
      );
    });

    it("handles object-like arguments that aren't metadata", () => {
      const date = new Date();
      log.info("Time is", date);
      expect(LogOutput.render).toHaveBeenCalledWith(
        expect.objectContaining({
          message: `Time is ${date}`,
        }),
        "terminal",
        undefined,
      );
    });
  });

  describe("groups", () => {
    let log: Log;

    beforeEach(() => {
      log = new Log({ level: "trace" });
    });

    it("creates and uses groups", () => {
      log.setGroup("Database");
      log.info("test message");

      expect(LogOutput.render).toHaveBeenCalledWith(
        expect.any(Object),
        "terminal",
        expect.objectContaining({
          name: "Database",
        }),
      );
    });

    it("supports nested groups", () => {
      log.setGroup("Database");
      log.setGroup("Query");
      log.info("test message");

      expect(LogOutput.render).toHaveBeenCalledWith(
        expect.any(Object),
        "terminal",
        expect.objectContaining({
          name: "Query",
          parent: expect.objectContaining({
            name: "Database",
          }),
        }),
      );
    });

    it("resets to parent group", () => {
      log.setGroup("Parent");
      log.setGroup("Child");
      log.resetGroup();
      log.info("test message");

      expect(LogOutput.render).toHaveBeenCalledWith(
        expect.any(Object),
        "terminal",
        expect.objectContaining({
          name: "Parent",
          parent: undefined,
        }),
      );
    });

    it("resets all groups", () => {
      log.setGroup("Parent");
      log.setGroup("Child");
      log.resetAllGroups();
      log.info("test message");

      expect(LogOutput.render).toHaveBeenCalledWith(
        expect.any(Object),
        "terminal",
        undefined,
      );
    });

    it("logs group operations at trace level", () => {
      log.setGroup("Test");
      expect(LogOutput.render).toHaveBeenCalledWith(
        expect.objectContaining({
          level: "trace",
          message: "Setting group",
          metadata: { groupName: "Test" },
        }),
        "terminal",
        undefined,
      );
    });
  });
});
