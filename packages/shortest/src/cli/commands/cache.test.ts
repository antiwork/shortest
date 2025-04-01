import { Command } from "commander";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { cacheCommands } from "./cache";
import { cleanUpCache } from "@/cache";
import { executeCommand } from "@/cli/utils/command-builder";

vi.mock("@/cache", () => ({
  cleanUpCache: vi.fn(),
}));

vi.mock("@/cli/utils/command-builder", () => ({
  executeCommand: vi.fn(),
}));

describe("cache commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("cacheCommands is a Command instance", () => {
    expect(cacheCommands).toBeInstanceOf(Command);
    expect(cacheCommands.name()).toBe("cache");
    expect(cacheCommands.description()).toBe("Cache management commands");
  });

  test("cacheCommands has clear subcommand", () => {
    const clearCommand = cacheCommands.commands.find(
      (cmd) => cmd.name() === "clear",
    );
    expect(clearCommand).toBeDefined();
    expect(clearCommand?.description()).toBe("Clear test cache");
  });

  test("clear command has proper options", () => {
    const clearCommand = cacheCommands.commands.find(
      (cmd) => cmd.name() === "clear",
    );

    expect(clearCommand?.opts().force_purge).toBeUndefined();
    expect(
      clearCommand?.options.find((opt) => opt.long === "--force-purge"),
    ).toBeDefined();
    expect(
      clearCommand?.options.find((opt) => opt.long === "--log-level"),
    ).toBeDefined();
  });

  test("clear command calls executeCommand with correct parameters", async () => {
    const clearCommand = cacheCommands.commands.find(
      (cmd) => cmd.name() === "clear",
    );

    await clearCommand?.parseAsync(["--force-purge", "--log-level", "debug"], {
      from: "user",
    });

    expect(executeCommand).toHaveBeenCalledWith(
      "clear",
      expect.objectContaining({ forcePurge: true, logLevel: "debug" }),
      expect.any(Function),
    );

    const callback = vi.mocked(executeCommand).mock.calls[0][2];
    await callback({ forcePurge: true, logLevel: "debug" });

    expect(cleanUpCache).toHaveBeenCalledWith({ forcePurge: true });
  });

  test("clear command with default options", async () => {
    const clearCommand = cacheCommands.commands.find(
      (cmd) => cmd.name() === "clear",
    );

    await clearCommand?.parseAsync([], { from: "user" });

    expect(executeCommand).toHaveBeenCalledWith(
      "clear",
      expect.objectContaining({ forcePurge: false }),
      expect.any(Function),
    );

    const callback = vi.mocked(executeCommand).mock.calls[0][2];
    await callback({ forcePurge: false });

    expect(cleanUpCache).toHaveBeenCalledWith({ forcePurge: false });
  });
});
