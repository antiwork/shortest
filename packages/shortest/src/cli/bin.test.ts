import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/log", () => ({
  getLogger: vi.fn().mockReturnValue({
    trace: vi.fn(),
    error: vi.fn(),
    config: {},
  }),
}));

describe("CLI bin structure", () => {
  beforeEach(() => {
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    vi.spyOn(process, "removeAllListeners").mockImplementation(() => process);
    vi.spyOn(process, "on").mockImplementation(() => process);

    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("process warning handlers are configured", async () => {
    const commands = await import("@/cli/commands");

    vi.spyOn(commands.shortestCommand, "addCommand").mockImplementation(
      () => commands.shortestCommand,
    );
    vi.spyOn(commands.shortestCommand, "parseAsync").mockResolvedValue(
      commands.shortestCommand,
    );
    vi.spyOn(commands.initCommand, "copyInheritedSettings").mockImplementation(
      () => commands.initCommand,
    );
    vi.spyOn(
      commands.githubCodeCommand,
      "copyInheritedSettings",
    ).mockImplementation(() => commands.githubCodeCommand);
    vi.spyOn(
      commands.cacheCommands,
      "copyInheritedSettings",
    ).mockImplementation(() => commands.cacheCommands);

    // Now import bin which will execute immediately
    await import("@/cli/bin");

    // Verify that process.removeAllListeners and process.on were called
    expect(process.removeAllListeners).toHaveBeenCalledWith("warning");
    expect(process.on).toHaveBeenCalledWith("warning", expect.any(Function));

    const warningHandler = (process.on as any).mock.calls[0][1];

    // Test punycode warning handling
    const punyWarning = new Error("Some warning about punycode");
    punyWarning.name = "DeprecationWarning";
    punyWarning.message = "The 'punycode' module is deprecated";
    warningHandler(punyWarning);
    expect(console.warn).not.toHaveBeenCalled();

    // Test other warning handling
    const otherWarning = new Error("Some other warning");
    otherWarning.name = "Warning";
    warningHandler(otherWarning);
    expect(console.warn).toHaveBeenCalledWith(otherWarning);
  });

  test("commands are correctly added to shortestCommand", async () => {
    // Import commands first to make mocking work properly
    const commands = await import("@/cli/commands");

    vi.spyOn(commands.shortestCommand, "addCommand").mockImplementation(
      () => commands.shortestCommand,
    );
    vi.spyOn(commands.shortestCommand, "parseAsync").mockResolvedValue(
      commands.shortestCommand,
    );
    vi.spyOn(commands.initCommand, "copyInheritedSettings").mockImplementation(
      () => commands.initCommand,
    );
    vi.spyOn(
      commands.githubCodeCommand,
      "copyInheritedSettings",
    ).mockImplementation(() => commands.githubCodeCommand);
    vi.spyOn(
      commands.cacheCommands,
      "copyInheritedSettings",
    ).mockImplementation(() => commands.cacheCommands);

    // Now import bin which will execute immediately
    await import("@/cli/bin");

    expect(commands.shortestCommand.addCommand).toHaveBeenCalledWith(
      commands.initCommand,
    );
    expect(commands.shortestCommand.addCommand).toHaveBeenCalledWith(
      commands.githubCodeCommand,
    );
    expect(commands.shortestCommand.addCommand).toHaveBeenCalledWith(
      commands.cacheCommands,
    );

    expect(commands.initCommand.copyInheritedSettings).toHaveBeenCalledWith(
      commands.shortestCommand,
    );
    expect(
      commands.githubCodeCommand.copyInheritedSettings,
    ).toHaveBeenCalledWith(commands.shortestCommand);
    expect(commands.cacheCommands.copyInheritedSettings).toHaveBeenCalledWith(
      commands.shortestCommand,
    );
  });
});
