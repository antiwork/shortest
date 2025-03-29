import { Command, Option } from "commander";
import { executeCommand } from "@/cli/utils/command-builder";
import { detectSupportedFramework } from "@/core/app-analyzer";
import { TestPlanner } from "@/core/test-planner";
import { getLogger } from "@/log";
import { LOG_LEVELS } from "@/log/config";

export const planCommand = new Command("plan").description(
  "Generate test plans from app analysis",
);

planCommand
  .addOption(
    new Option("--log-level <level>", "Set logging level").choices(LOG_LEVELS),
  )
  .addOption(
    new Option(
      "--force",
      "Force plan generation even if cached data exists",
    ).default(false),
  )
  .action(async function () {
    await executeCommand(this.name(), this.optsWithGlobals(), async () =>
      executePlanCommand(this.opts()),
    );
  })
  .showHelpAfterError("(add --help for additional information)");

const executePlanCommand = async (
  options: { force?: boolean } = {},
): Promise<void> => {
  const log = getLogger();
  const cwd = process.cwd();
  const supportedFramework = await detectSupportedFramework();
  log.info(`Generating test plans...`);

  const planner = new TestPlanner(cwd, supportedFramework);
  const testPlans = await planner.execute(options);

  log.info(`Test planning complete. Generated ${testPlans.length} test plans.`);
};
