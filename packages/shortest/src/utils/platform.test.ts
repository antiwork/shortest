import { detect, resolveCommand } from "package-manager-detector";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { ShortestError } from "./errors";
import { getInstallationCommand } from "./platform";

vi.mock("package-manager-detector", () => ({
  detect: vi.fn(),
  resolveCommand: vi.fn(),
}));

describe("platform utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getInstallationCommand", () => {
    it("returns the correct installation command for npm", async () => {
      (detect as any).mockResolvedValue({ agent: "npm" });

      (resolveCommand as any).mockReturnValue({
        command: "npx",
        args: ["playwright", "install", "chromium"],
      });

      const command = await getInstallationCommand();

      expect(detect).toHaveBeenCalledTimes(1);
      expect(resolveCommand).toHaveBeenCalledWith("npm", "execute", [
        "playwright",
        "install",
        "chromium",
      ]);
      expect(command).toBe("npx playwright install chromium");
    });

    it("returns the correct installation command for yarn", async () => {
      (detect as any).mockResolvedValue({ agent: "yarn" });

      (resolveCommand as any).mockReturnValue({
        command: "yarn",
        args: ["dlx", "playwright", "install", "chromium"],
      });

      const command = await getInstallationCommand();

      expect(detect).toHaveBeenCalledTimes(1);
      expect(resolveCommand).toHaveBeenCalledWith("yarn", "execute", [
        "playwright",
        "install",
        "chromium",
      ]);
      expect(command).toBe("yarn dlx playwright install chromium");
    });

    it("returns the correct installation command for pnpm", async () => {
      (detect as any).mockResolvedValue({ agent: "pnpm" });

      (resolveCommand as any).mockReturnValue({
        command: "pnpm",
        args: ["dlx", "playwright", "install", "chromium"],
      });

      const command = await getInstallationCommand();

      expect(detect).toHaveBeenCalledTimes(1);
      expect(resolveCommand).toHaveBeenCalledWith("pnpm", "execute", [
        "playwright",
        "install",
        "chromium",
      ]);
      expect(command).toBe("pnpm dlx playwright install chromium");
    });

    it("throws an error when no package manager is detected", async () => {
      (detect as any).mockResolvedValue(null);

      await expect(getInstallationCommand()).rejects.toThrow(ShortestError);
      await expect(getInstallationCommand()).rejects.toThrow(
        "No package manager detected",
      );

      expect(detect).toHaveBeenCalledTimes(2);
      expect(resolveCommand).not.toHaveBeenCalled();
    });

    it("throws an error when command resolution fails", async () => {
      (detect as any).mockResolvedValue({ agent: "npm" });

      (resolveCommand as any).mockReturnValue(null);

      await expect(getInstallationCommand()).rejects.toThrow(ShortestError);
      await expect(getInstallationCommand()).rejects.toThrow(
        "Failed to resolve Playwright browser installation command",
      );

      expect(detect).toHaveBeenCalledTimes(2);
      expect(resolveCommand).toHaveBeenCalledTimes(2);
    });
  });
});
