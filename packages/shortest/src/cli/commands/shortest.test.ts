import { Command } from "commander";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { shortestCommand } from "./shortest";
import {
  cleanUpCache,
  purgeLegacyCache,
  purgeLegacyScreenshots,
} from "@/cache";
import { executeCommand } from "@/cli/utils/command-builder";
import { TestRunner } from "@/core/runner";
import { initializeConfig } from "@/index";

vi.mock("@/cli/utils/command-builder", () => ({
  executeCommand: vi.fn(),
}));

vi.mock("@/index", () => ({
  initializeConfig: vi.fn(),
  getConfig: vi.fn().mockReturnValue({
    testPattern: "test-pattern",
  }),
}));

const mockInitialize = vi.fn().mockResolvedValue(undefined);
const mockExecute = vi.fn().mockResolvedValue(true);

vi.mock("@/core/runner", () => ({
  TestRunner: vi.fn().mockImplementation(() => ({
    initialize: mockInitialize,
    execute: mockExecute,
  })),
}));

vi.mock("@/cache", () => ({
  cleanUpCache: vi.fn(),
  purgeLegacyCache: vi.fn(),
  purgeLegacyScreenshots: vi.fn(),
}));

vi.mock("@/log", () => ({
  getLogger: vi.fn().mockReturnValue({
    trace: vi.fn(),
    error: vi.fn(),
    config: {},
  }),
}));

describe("shortest command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("shortestCommand is a Command instance", () => {
    expect(shortestCommand).toBeInstanceOf(Command);
    expect(shortestCommand.name()).toBe("shortest");
    expect(shortestCommand.description()).toContain(
      "AI-powered end-to-end testing framework",
    );
  });

  test("shortestCommand has correct options", () => {
    expect(
      shortestCommand.options.find((opt) => opt.long === "--log-level"),
    ).toBeDefined();
    expect(
      shortestCommand.options.find((opt) => opt.long === "--headless"),
    ).toBeDefined();
    expect(
      shortestCommand.options.find((opt) => opt.long === "--target"),
    ).toBeDefined();
    expect(
      shortestCommand.options.find((opt) => opt.long === "--no-cache"),
    ).toBeDefined();
  });

  test("shortestCommand calls executeCommand with correct parameters", async () => {
    await shortestCommand.parseAsync(
      ["test-file.ts", "--headless", "--target", "http://example.com"],
      { from: "user" },
    );

    expect(executeCommand).toHaveBeenCalledWith(
      "shortest",
      expect.objectContaining({
        headless: true,
        target: "http://example.com",
      }),
      expect.any(Function),
    );
  });

  test("shortestCommand with default options", async () => {
    await shortestCommand.parseAsync([], { from: "user" });

    expect(executeCommand).toHaveBeenCalledWith(
      "shortest",
      expect.any(Object),
      expect.any(Function),
    );
  });

  test("executeTestRunnerCommand executes test runner with correct options", async () => {
    await shortestCommand.parseAsync(
      ["test-file.ts:123", "--headless", "--no-cache"],
      { from: "user" },
    );

    const callback = vi.mocked(executeCommand).mock.calls[0][2];

    await callback({});

    expect(initializeConfig).toHaveBeenCalledWith({
      cliOptions: expect.objectContaining({
        headless: true,
        testPattern: "test-file.ts",
        noCache: true,
      }),
    });

    expect(purgeLegacyCache).toHaveBeenCalled();
    expect(purgeLegacyScreenshots).toHaveBeenCalled();

    expect(TestRunner).toHaveBeenCalled();
    expect(mockInitialize).toHaveBeenCalled();
    expect(mockExecute).toHaveBeenCalledWith("test-pattern", 123);

    expect(cleanUpCache).toHaveBeenCalled();
  });
});
