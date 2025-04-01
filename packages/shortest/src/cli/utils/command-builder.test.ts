import { describe, test, expect, vi, beforeEach } from "vitest";
import { executeCommand } from "./command-builder";
import { LogLevel } from "@/log/config";
import { getLogger } from "@/log/index";
import { getErrorDetails } from "@/utils/errors";

vi.mock("@/log/index", () => ({
  getLogger: vi.fn(),
}));

vi.mock("@/utils/errors", () => ({
  getErrorDetails: vi.fn(),
}));

describe("command-builder", () => {
  describe("executeCommand", () => {
    const mockLogger = {
      trace: vi.fn(),
      error: vi.fn(),
    };

    beforeEach(() => {
      vi.clearAllMocks();
      vi.mocked(getLogger).mockReturnValue(mockLogger as any);
      vi.mocked(getErrorDetails).mockReturnValue({ message: "Error details" });
    });

    test("executes function with provided options", async () => {
      const testCommandName = "test-command";
      const testOptions = {
        logLevel: "debug" as LogLevel,
        someOption: "value",
      };
      const testFunction = vi.fn().mockResolvedValue(undefined);

      await executeCommand(testCommandName, testOptions, testFunction);

      expect(getLogger).toHaveBeenCalledWith({ level: "debug" });
      expect(mockLogger.trace).toHaveBeenCalledWith(
        "Executing test-command command",
        { options: testOptions },
      );
      expect(testFunction).toHaveBeenCalledWith(testOptions);
    });

    test("handles undefined logLevel", async () => {
      const testOptions = {
        logLevel: undefined as LogLevel | undefined,
        someOption: "value",
      };
      const testFunction = vi.fn().mockResolvedValue(undefined);

      await executeCommand("test-command", testOptions, testFunction);

      expect(getLogger).toHaveBeenCalledWith({ level: undefined });
    });

    test("logs error and rethrows when function throws", async () => {
      const testError = new Error("Test error");
      const testFunction = vi.fn().mockRejectedValue(testError);

      await expect(
        executeCommand(
          "failed-command",
          { logLevel: "info" as LogLevel },
          testFunction,
        ),
      ).rejects.toThrow(testError);

      expect(mockLogger.error).toHaveBeenCalledWith(
        "Command failed-command failed",
        { message: "Error details" },
      );
      expect(getErrorDetails).toHaveBeenCalledWith(testError);
    });
  });
});
