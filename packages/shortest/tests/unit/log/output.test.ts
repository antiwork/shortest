import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { LOG_LEVELS } from "@/log/config";
import { LogEvent } from "@/log/event";
import { LogGroup } from "@/log/group";
import { LogOutput } from "@/log/output";

// Mock only what we need to verify - the colors and console output
vi.mock("picocolors", () => ({
  default: {
    white: (str: string) => `white(${str})`,
    red: (str: string) => `red(${str})`,
    yellow: (str: string) => `yellow(${str})`,
    yellowBright: (str: string) => `yellowBright(${str})`,
    cyan: (str: string) => `cyan(${str})`,
    green: (str: string) => `green(${str})`,
    gray: (str: string) => `gray(${str})`,
    dim: (str: string) => `dim(${str})`,
  },
}));

describe("LogOutput", () => {
  const mockTimestamp = "19:00:00";
  const maxLevelLength = Math.max(...LOG_LEVELS.map((level) => level.length));

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T19:00:00"));
    // Mock write methods for stdout and stderr
    vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("terminal format", () => {
    it("renders basic log message", () => {
      const event = new LogEvent("info", "test message");
      LogOutput.render(event, "terminal", process.stdout);

      expect(process.stdout.write).toHaveBeenCalledWith(
        `cyan(info${" ".repeat(maxLevelLength - 4)}) | ${mockTimestamp} | test message\n`,
      );
    });

    it("renders message with metadata", () => {
      const event = new LogEvent("debug", "test with metadata", {
        userId: 123,
        details: { key: "value" },
      });
      LogOutput.render(event, "terminal", process.stdout);

      expect(process.stdout.write).toHaveBeenCalledWith(
        `green(debug${" ".repeat(maxLevelLength - 5)}) | ${mockTimestamp} | test with metadata | dim(userId)=123 dim(details)={\n  "key": "value"\n}\n\n`,
      );
    });
  });

  describe("reporter format", () => {
    it("renders basic message", () => {
      const event = new LogEvent("info", "test message");
      LogOutput.render(event, "reporter", process.stdout);

      expect(process.stdout.write).toHaveBeenCalledWith("test message\n");
    });

    it("renders grouped message with indentation", () => {
      const root = new LogGroup({} as any, "Root");
      const child = new LogGroup({} as any, "Child", root);
      const event = new LogEvent("info", "test message");

      LogOutput.render(event, "reporter", process.stdout, child);

      expect(process.stdout.write).toHaveBeenCalledWith("    test message\n");
    });
  });

  describe("error handling", () => {
    it("throws on unsupported format", () => {
      const event = new LogEvent("info", "test");
      expect(() =>
        LogOutput.render(event, "invalid" as any, process.stdout),
      ).toThrow("Unsupported log format: invalid");
    });
  });

  describe("log levels", () => {
    it.each([
      ["error", "red", process.stderr],
      ["warn", "yellow", process.stderr],
      ["info", "cyan", process.stdout],
      ["debug", "green", process.stdout],
      ["trace", "gray", process.stdout],
    ])("uses correct color and method for %s level", (level, color, stream) => {
      const event = new LogEvent(level as any, "test message");
      LogOutput.render(event, "terminal", process.stdout);

      const paddedLevel = level.padEnd(maxLevelLength);
      let message = "test message";
      if (level === "error") {
        message = `red(${message})`;
      }
      const output = `${color}(${paddedLevel}) | ${mockTimestamp} | ${message}`;
      const expectedOutput =
        level === "warn" ? `yellowBright(${output})` : output;

      expect(stream.write).toHaveBeenCalledWith(`${expectedOutput}\n`);
    });
  });
});
