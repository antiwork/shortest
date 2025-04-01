import { detect, resolveCommand } from "package-manager-detector";
import { ShortestError } from "@/utils/errors";

export const getInstallationCommand = async () => {
  const packageManager = await detect();

  if (!packageManager) {
    throw new ShortestError("No package manager detected");
  }

  const command = resolveCommand(packageManager.agent, "execute", [
    "playwright",
    "install",
    "chromium",
  ]);

  if (!command) {
    throw new ShortestError(
      "Failed to resolve Playwright browser installation command",
    );
  }

  return `${command.command} ${command.args.join(" ")}`;
};
