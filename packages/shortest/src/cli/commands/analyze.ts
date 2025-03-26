import { Command, Option } from "commander";
import { executeCommand } from "@/cli/utils/command-builder";
import { AppAnalyzer, SUPPORTED_FRAMEWORKS } from "@/core/app-analyzer";
import { getProjectInfo } from "@/core/framework-detector";
import { getLogger } from "@/log";
import { LOG_LEVELS } from "@/log/config";
import { ShortestError } from "@/utils/errors";

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
  const projectInfo = await getProjectInfo();
  const supportedFrameworks = projectInfo.data.frameworks.filter((f) =>
    SUPPORTED_FRAMEWORKS.includes(f.id),
  );

  if (supportedFrameworks.length === 0) {
    throw new ShortestError(`No supported framework found`);
  }

  if (supportedFrameworks.length > 1) {
    throw new ShortestError(
      `Multiple supported frameworks found: ${supportedFrameworks.map((f) => f.name).join(", ")}`,
    );
  }

  const framework = supportedFrameworks[0].id;

  log.info(`Analyzing ${framework} application structure...`);

  const analyzer = new AppAnalyzer(cwd, framework);
  const analysis = await analyzer.execute(options);

  log.info(
    `Analysis complete. Found ${analysis.stats.routeCount} routes, ` +
      `${analysis.stats.apiRouteCount} API routes in ${analysis.stats.fileCount} files.`,
  );
};
