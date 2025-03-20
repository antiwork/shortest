#!/usr/bin/env node
import pc from "picocolors";
import {
  createShortestCommand,
  githubCodeCommand,
  initCommand,
  cacheCommands,
  executeRunCommand,
  executeCommand,
} from "@/cli/commands";
import { ENV_LOCAL_FILENAME } from "@/constants";
import { getLogger } from "@/log/index";
import { cliOptionsSchema } from "@/types/config";
import { ShortestError } from "@/utils/errors";

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

const program = createShortestCommand("shortest")
  .configureHelp({
    showGlobalOptions: true,
    styleTitle: (title) => pc.bold(title),
  })
  .configureOutput({
    outputError: (str, write) => write(pc.red(str)),
  })
  .showHelpAfterError("(add --help for additional information)");

program
  .argument(
    "[test-pattern]",
    "Test pattern to run",
    cliOptionsSchema.shape.testPattern._def.defaultValue(),
  )
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
  .action(async (testPattern, _options, command) => {
    await executeCommand(
      command.name(),
      command.optsWithGlobals(),
      async () =>
        await executeRunCommand(testPattern, command.optsWithGlobals()),
    );
  });
program.addCommand(initCommand);
program.addCommand(githubCodeCommand);
program.addCommand(cacheCommands);

const main = async () => {
  try {
    await program.parseAsync();
    process.exit(0);
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
  log.trace("Handling error in main catch block");
  if (!(error instanceof ShortestError)) throw error;

  console.error(pc.red(error.name), error.message);
  process.exit(1);
});
