import { Command, Option } from "commander";
import pc from "picocolors";
import { GitHubTool } from "@/browser/integrations/github";
import { executeCommand } from "@/cli/utils/command-builder";
import { ENV_LOCAL_FILENAME } from "@/constants";
import { LOG_LEVELS } from "@/log/config";

export const githubCodeCommand = new Command("github-code")
  .description("Generate GitHub 2FA code for authentication")
  .addHelpText(
    "after",
    `
${pc.bold("Environment setup:")}
  Required in ${ENV_LOCAL_FILENAME}:
      GITHUB_TOTP_SECRET                          GitHub 2FA secret
      GITHUB_USERNAME                             GitHub username
      GITHUB_PASSWORD                             GitHub password
`,
  );

githubCodeCommand
  .option(
    "--secret <key>",
    `GitHub OTP secret key (can also be set in ${ENV_LOCAL_FILENAME})`,
  )
  // This is needed to show in help without calling showGlobalOptions, which would show all global options that
  // are not relevant (e.g. --headless, --target, --no-cache)
  .addOption(
    new Option("--log-level <level>", "Set logging level").choices(LOG_LEVELS),
  )
  .action(async function () {
    await executeCommand(
      this.name(),
      this.optsWithGlobals(),
      async () => await executeGithubCodeCommand(this.opts().secret),
    );
  })
  .showHelpAfterError("(add --help for additional information)");

const executeGithubCodeCommand = async (secret: string) => {
  const github = new GitHubTool(secret);
  const { code, timeRemaining } = await github.generateTOTPCode();

  console.log("\n" + pc.bgCyan(pc.black(" GitHub 2FA Code ")));
  console.log(pc.cyan("Code: ") + pc.bold(code));
  console.log(pc.cyan("Expires in: ") + pc.bold(`${timeRemaining}s`));
};
