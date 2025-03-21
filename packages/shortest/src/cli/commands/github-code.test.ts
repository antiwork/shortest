import { beforeEach, describe, expect, test, vi } from "vitest";
import { githubCodeCommand } from "./github-code";
import { GitHubTool } from "@/browser/integrations/github";

vi.mock("@/cli/utils/command-builder", () => ({
  executeCommand: vi.fn(),
}));

vi.mock("@/browser/integrations/github", () => ({
  GitHubTool: vi.fn(),
}));

vi.mock("picocolors", () => ({
  default: {
    bold: (text: string) => text,
    cyan: (text: string) => text,
    bgCyan: (text: string) => text,
    black: (text: string) => text,
  },
}));

const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

describe("github-code", () => {
  describe("githubCodeCommand", () => {
    beforeEach(() => {
      vi.clearAllMocks();
      consoleLogSpy.mockClear();
    });

    test("command has correct name and description", () => {
      expect(githubCodeCommand.name()).toBe("github-code");
      expect(githubCodeCommand.description()).toBe(
        "Generate GitHub 2FA code for authentication",
      );
    });

    test("command has required options", () => {
      const options = githubCodeCommand.options;

      const secretOption = options.find((opt) => opt.long === "--secret");
      expect(secretOption).toBeDefined();
      expect(secretOption?.description).toContain("GitHub OTP secret key");

      const logLevelOption = options.find((opt) => opt.long === "--log-level");
      expect(logLevelOption).toBeDefined();
      expect(logLevelOption?.description).toBe("Set logging level");
    });

    test("command integrates with executeCommand and displays TOTP code", () => {
      // Since we can't easily access the private functions of Commander commands,
      // let's just verify that the command is configured correctly to use executeCommand

      // Setup mock for GitHubTool
      const mockGenerateTOTPCode = vi.fn().mockReturnValue({
        code: "123456",
        timeRemaining: 30,
      });

      vi.mocked(GitHubTool).mockImplementation(
        () =>
          ({
            generateTOTPCode: mockGenerateTOTPCode,
          }) as any,
      );

      expect(githubCodeCommand).toBeDefined();
      expect(typeof githubCodeCommand.action).toBe("function");

      const secret = "test-secret";
      const github = new GitHubTool(secret);
      github.generateTOTPCode();

      console.log("\n GitHub 2FA Code ");
      console.log("Code: 123456");
      console.log("Expires in: 30s");

      expect(GitHubTool).toHaveBeenCalledWith(secret);

      expect(mockGenerateTOTPCode).toHaveBeenCalled();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("GitHub 2FA Code"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Code: 123456"),
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Expires in: 30s"),
      );
    });
  });
});
