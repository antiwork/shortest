import { Command } from "commander";
import pc from "picocolors";
import { GitHubTool } from "@/browser/integrations/github";
import { executeCommand } from "@/cli/utils/command-builder";
import { ENV_LOCAL_FILENAME } from "@/constants";

export const githubCodeCommand = new Command("github-code")
  .description("Generate GitHub 2FA code for authentication")
  .configureOutput({
    outputError: (str, write) => write(pc.red(str)),
  })
  .option(
    "--secret <key>",
    `GitHub OTP secret key (can also be set in ${ENV_LOCAL_FILENAME})`,
  )
  .addHelpText(
    "after",
    `
${pc.bold("Environment setup:")}
  Required in ${ENV_LOCAL_FILENAME}:
      GITHUB_TOTP_SECRET                          GitHub 2FA secret
      GITHUB_USERNAME                             GitHub username
      GITHUB_PASSWORD                             GitHub password
`,
  )
  .action(async function () {
    await executeCommand(this.name(), this.optsWithGlobals(), async () =>
      executeGithubCodeCommand(this.opts().secret),
    );
  })
  .showHelpAfterError("(add --help for additional information)");

const executeGithubCodeCommand = async (secret: string) => {
  const github = new GitHubTool(secret);
  const { code, timeRemaining } = github.generateTOTPCode();

  console.log("\n" + pc.bgCyan(pc.black(" GitHub 2FA Code ")));
  console.log(pc.cyan("Code: ") + pc.bold(code));
  console.log(pc.cyan("Expires in: ") + pc.bold(`${timeRemaining}s`));
};
