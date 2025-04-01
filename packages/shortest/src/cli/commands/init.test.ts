import { Command } from "commander";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { initCommand } from "./init";
import { executeCommand } from "@/cli/utils/command-builder";

vi.mock("@/cli/utils/command-builder", () => ({
  executeCommand: vi.fn(),
}));

describe("init command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("initCommand is a Command instance", () => {
    expect(initCommand).toBeInstanceOf(Command);
    expect(initCommand.name()).toBe("init");
    expect(initCommand.description()).toBe(
      "Initialize Shortest in current directory",
    );
  });

  test("initCommand calls executeCommand with correct parameters", async () => {
    await initCommand.parseAsync(["--log-level", "debug"], { from: "user" });

    expect(executeCommand).toHaveBeenCalledWith(
      "init",
      expect.objectContaining({ logLevel: "debug" }),
      expect.any(Function),
    );
  });

  test("initCommand with default options", async () => {
    await initCommand.parseAsync([], { from: "user" });

    expect(executeCommand).toHaveBeenCalledWith(
      "init",
      expect.any(Object),
      expect.any(Function),
    );
  });
});
