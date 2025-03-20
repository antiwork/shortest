#!/usr/bin/env node
import { Command, Option } from "commander";
import pc from "picocolors";
import { GitHubTool } from "@/browser/integrations/github";
import {
  purgeLegacyCache,
  cleanUpCache,
  purgeLegacyScreenshots,
} from "@/cache";
import { ENV_LOCAL_FILENAME } from "@/constants";
import { TestRunner } from "@/core/runner";
import { getConfig, initializeConfig } from "@/index";
import { LOG_LEVELS, LogLevel } from "@/log/config";
import { getLogger } from "@/log/index";
import { CLIOptions } from "@/types";
import { getErrorDetails, ShortestError } from "@/utils/errors";

process.removeAllListeners("warning");
process.on("warning", (warning) => {
  if (
    warning.name === "DeprecationWarning" &&
    warning.message.includes("punycode")
  ) {
    return;
  }
  console.warn(warning);
});

const { version: currentVersion } = require("../../package.json");
class RootCommand extends Command {
  createCommand(name: string) {
    const cmd = new Command(name);
    cmd.addOption(
      new Option("--log-level <level>", "Set logging level").choices(
        LOG_LEVELS,
      ),
    );
    return cmd;
  }
}
const program = new RootCommand();

program
  .name("shortest")
  .description("AI-powered end-to-end testing framework")
  .version(currentVersion)
  .option("--headless", "Run tests in headless browser mode")
  .option(
    "--target <url>",
    "Set target URL for tests (default: http://localhost:3000)",
  )
  .option("--no-cache", "Disable test action caching", false)

  .option(
    "--debug-ai",
    "Enable AI debug logging (deprecated, use --log-level=debug instead)",
  );

program
  .command("github-code")
  .description("Generate GitHub 2FA code for authentication")
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
  .action(async (options) => {
    try {
      await initializeConfig({});
      const log = getLogger({
        level: options.logLevel as LogLevel,
      });
      console.log("options", options);
      log.trace("Executing github-code command", { options });

      const secret = options.secret;
      const github = new GitHubTool(secret);
      const { code, timeRemaining } = github.generateTOTPCode();

      console.log("\n" + pc.bgCyan(pc.black(" GitHub 2FA Code ")));
      console.log(pc.cyan("Code: ") + pc.bold(code));
      console.log(pc.cyan("Expires in: ") + pc.bold(`${timeRemaining}s`));
      console.log(
        pc.dim(`Using secret from: ${secret ? "CLI flag" : ".env file"}\n`),
      );

      process.exit(0);
    } catch (error) {
      console.error(pc.red("\n✖ Error:"), (error as Error).message, "\n");
      process.exit(1);
    }
  });

program
  .command("init")
  .description("Initialize Shortest in current directory")
  .action(async () => {
    await require("./init").default();
    process.exit(0);
  });

program
  .command("cache")
  .description("Cache management commands")
  .addCommand(
    new Command("clear")
      .description("Clear test cache")
      .option("--force-purge", "Force purge of all cache files", false)
      .action(async (options, cmd) => {
        const log = getLogger({
          level: cmd.optsWithGlobals().logLevel as LogLevel,
        });
        log.trace("Executing cache clear command", cmd.optsWithGlobals());

        await cleanUpCache({ forcePurge: options.forcePurge });
        log.info("Cache cleared");
        process.exit(0);
      }),
  );

program
  .argument("[pattern]", "Test pattern to run (default: **/*.test.ts)")
  .addHelpText(
    "after",
    `
${pc.bold("Environment setup:")}
  Required in ${ENV_LOCAL_FILENAME}:
    AI authentication
      SHORTEST_ANTHROPIC_API_KEY                  Anthropic API key for AI test execution
      ANTHROPIC_API_KEY                           Alternative Anthropic API key (only one is required)

${pc.bold("Documentation:")}
  ${pc.cyan("https://github.com/antiwork/shortest")}
`,
  )
  .action(async (testPattern, options) => {
    const log = getLogger({
      level: options.logLevel as LogLevel,
    });

    if (options.debugAi) {
      log.config.level = "debug";
      log.warn("--debug-ai is deprecated, use --log-level=debug instead");
    }

    log.trace("Starting Shortest CLI", { args: process.argv });
    log.trace("Log config", { ...log.config });

    let lineNumber: number | undefined;

    if (testPattern?.includes(":")) {
      const [file, line] = testPattern.split(":");
      testPattern = file;
      lineNumber = parseInt(line, 10);
    }

    const cliOptions: CLIOptions = {
      headless: options.headless,
      baseUrl: options.target,
      testPattern,
      noCache: !options.cache,
    };

    log.trace("Initializing config with CLI options", { cliOptions });
    await initializeConfig({ cliOptions });
    const config = getConfig();

    await purgeLegacyCache();
    await purgeLegacyScreenshots();

    try {
      log.trace("Initializing TestRunner");
      const runner = new TestRunner(process.cwd(), config);
      await runner.initialize();
      const success = await runner.execute(
        testPattern ?? config.testPattern,
        lineNumber,
      );
      process.exitCode = success ? 0 : 1;
    } catch (error: any) {
      log.trace("Handling error for TestRunner");
      if (!(error instanceof ShortestError)) throw error;

      console.error(pc.red(error.name));
      console.error(error.message, getErrorDetails(error));
      process.exitCode = 1;
    } finally {
      await cleanUpCache();
    }
    process.exit();
  });

program.showHelpAfterError("(add --help for additional information)");

const main = async () => {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    const log = getLogger();
    log.trace("Handling error on main()");
    if (!(error instanceof ShortestError)) throw error;

    console.error(pc.red(error.name), error.message);
    process.exit(1);
  }
};

main().catch(async (error) => {
  const log = getLogger();
  log.trace("Handling error on main()");
  if (!(error instanceof ShortestError)) throw error;

  console.error(pc.red(error.name), error.message);
  process.exit(1);
});
