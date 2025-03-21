import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { listFrameworks } from "@netlify/framework-info";
import { Command, Option } from "commander";
import { simpleGit, SimpleGit, CleanOptions } from "simple-git";
import { DOT_SHORTEST_DIR_NAME, DOT_SHORTEST_DIR_PATH } from "@/cache";
import { executeCommand } from "@/cli/utils/command-builder";
import { getLogger } from "@/log";
import { LOG_LEVELS } from "@/log/config";
import { directoryExists } from "@/utils/directory-exists";
import { getErrorDetails, ShortestError } from "@/utils/errors";

export const detectFrameworkCommand = new Command(
  "detect-framework",
).description("Detect the framework(s) of the current project");

detectFrameworkCommand
  .addOption(
    new Option("--log-level <level>", "Set logging level").choices(LOG_LEVELS),
  )
  .addOption(
    new Option("--force", "Force detection even if cached data exists").default(
      false,
    ),
  )
  .action(async function () {
    await executeCommand(this.name(), this.optsWithGlobals(), async () =>
      executeDetectFrameworkCommand(this.opts()),
    );
  })
  .showHelpAfterError("(add --help for additional information)");

const PROJECT_JSON_PATH = path.join(DOT_SHORTEST_DIR_PATH, "project.json");

const executeDetectFrameworkCommand = async (
  options: { force?: boolean } = {},
) => {
  const log = getLogger();

  if (!options.force && existsSync(PROJECT_JSON_PATH)) {
    try {
      const projectInfo = JSON.parse(
        await fs.readFile(PROJECT_JSON_PATH, "utf-8"),
      );
      log.trace("Using cached framework information");
      console.log(projectInfo);
      return;
    } catch (error) {
      log.trace(
        "Failed to read cached project data, performing detection",
        getErrorDetails(error),
      );
    }
  }

  const frameworks = await listFrameworks({ projectDir: process.cwd() });

  if (!(await directoryExists(DOT_SHORTEST_DIR_PATH))) {
    await fs.mkdir(DOT_SHORTEST_DIR_PATH, { recursive: true });
    log.trace(`Created ${DOT_SHORTEST_DIR_NAME} directory`);
  }

  try {
    const VERSION = 1;

    const projectInfo = {
      metadata: {
        timestamp: Date.now(),
        version: VERSION,
        git: await getGitInfo(),
      },
      data: frameworks,
    };

    await fs.writeFile(
      PROJECT_JSON_PATH,
      JSON.stringify(projectInfo, null, 2),
      "utf-8",
    );
    log.debug("Saved framework information to project.json");
  } catch (error) {
    log.error("Failed to save framework information", { error });
    throw new ShortestError("Failed to save framework information");
  }
};

const getGitInfo = async () => {
  const log = getLogger();

  try {
    const git: SimpleGit = simpleGit().clean(CleanOptions.FORCE);
    const branchInfo = await git.branch();
    return {
      branch: branchInfo.current,
      commit: await git.revparse(["HEAD"]),
    };
  } catch (error) {
    log.error("Failed to get git info", getErrorDetails(error));
    return {
      branch: null,
      commit: null,
    };
  }
};
