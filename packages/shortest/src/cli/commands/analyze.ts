import { Command, Option } from "commander";
import { executeCommand } from "@/cli/utils/command-builder";
import { AppAnalyzer, detectSupportedFramework } from "@/core/app-analyzer";
import { getLogger } from "@/log";
import { LOG_LEVELS } from "@/log/config";

export const analyzeCommand = new Command("analyze").description(
  "Analyze the structure of the project",
);

analyzeCommand
  .addOption(
    new Option("--log-level <level>", "Set logging level").choices(LOG_LEVELS),
  )
  .addOption(
    new Option("--force", "Force analysis even if cached data exists").default(
      false,
    ),
  )
  .action(async function () {
    await executeCommand(this.name(), this.optsWithGlobals(), async () =>
      executeAnalyzeCommand(this.opts()),
    );
  })
  .showHelpAfterError("(add --help for additional information)");

const executeAnalyzeCommand = async (
  options: { force?: boolean } = {},
): Promise<void> => {
  const log = getLogger();
  const cwd = process.cwd();
  const supportedFramework = await detectSupportedFramework();
  log.info(`Analyzing ${supportedFramework} application structure...`);

  const analyzer = new AppAnalyzer(cwd, supportedFramework);
  const analysis = await analyzer.execute(options);

  log.info(
    `Analysis complete. Found ${analysis.stats.routeCount} routes, ` +
      `${analysis.stats.apiRouteCount} API routes in ${analysis.stats.fileCount} files.`,
  );
};
