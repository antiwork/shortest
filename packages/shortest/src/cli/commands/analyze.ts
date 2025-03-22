import { Command, Option } from "commander";
import { executeCommand } from "@/cli/utils/command-builder";
import { AppAnalyzer } from "@/core/app-analyzer";
import { getLogger } from "@/log";
import { LOG_LEVELS } from "@/log/config";

export const analyzeCommand = new Command("analyze").description(
  "Analyze the structure of your project and generate test planning insights",
);

analyzeCommand
  .addOption(
    new Option("--log-level <level>", "Set logging level").choices(LOG_LEVELS)
  )
  .addOption(
    new Option("--force", "Force analysis even if cached data exists").default(
      false,
    ),
  )
  .addOption(
    new Option(
      "--framework <framework>",
      "Specify the framework to analyze",
    ).default("next"),
  )
  .action(async function () {
    await executeCommand(this.name(), this.optsWithGlobals(), async () =>
      executeAnalyzeCommand(this.opts()),
    );
  })
  .showHelpAfterError("(add --help for additional information)");

const executeAnalyzeCommand = async (
  options: { force?: boolean; framework?: string } = {},
): Promise<void> => {
  const log = getLogger();
  const cwd = process.cwd();

  log.info(`Analyzing ${options.framework || "next"} application structure...`);

  const analyzer = new AppAnalyzer(cwd, options.framework || "next");
  const analysis = await analyzer.analyze(options);

  log.info(
    `Analysis complete. Found ${analysis.nextRoutes?.length || 0} routes, ` +
      `${analysis.nextApiRoutes?.length || 0} API routes, and ` +
      `${analysis.filesScanned} files.`,
  );

  log.info("Results saved to .shortest/next/analysis.json");

  if (analysis.testPlanningContext) {
    log.info(
      "Generated test planning context with " +
        `${analysis.testPlanningContext.mainPages.length} pages, ` +
        `${analysis.testPlanningContext.apiEndpoints.length} API endpoints, and ` +
        `${analysis.testPlanningContext.suggestedTestFlows.length} suggested test flows.`,
    );
  }
};
