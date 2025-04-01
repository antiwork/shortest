import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { listFrameworks } from "@netlify/framework-info";
import { Framework } from "@netlify/framework-info/lib/types";
import { DOT_SHORTEST_DIR_PATH } from "@/cache";
import { FrameworkInfo } from "@/core/app-analyzer";
import { getPaths } from "@/core/app-analyzer/utils/get-tree-structure";
import { getLogger } from "@/log";
import { getErrorDetails, ShortestError } from "@/utils/errors";
import { getGitInfo, GitInfo } from "@/utils/get-git-info";

export interface ProjectInfo {
  metadata: {
    timestamp: number;
    version: number;
    git: GitInfo;
  };
  data: {
    frameworks: FrameworkInfo[];
  };
}

export const PROJECT_JSON_PATH = path.join(
  DOT_SHORTEST_DIR_PATH,
  "project.json",
);

export const getProjectInfo = async (): Promise<ProjectInfo> => {
  const log = getLogger();
  try {
    return JSON.parse(await fs.readFile(PROJECT_JSON_PATH, "utf-8"));
  } catch (error) {
    log.error("Failed to read cached project data", getErrorDetails(error));
    throw new ShortestError(
      "Failed to read cached project data, execute shortest detect-framework first",
    );
  }
};

export const detectFramework = async (options: { force?: boolean } = {}) => {
  const log = getLogger();

  if (!options.force && existsSync(PROJECT_JSON_PATH)) {
    try {
      const projectInfo = JSON.parse(
        await fs.readFile(PROJECT_JSON_PATH, "utf-8"),
      );
      log.trace("Using cached framework information");
      return projectInfo;
    } catch (error) {
      log.trace(
        "Failed to read cached project data, performing detection",
        getErrorDetails(error),
      );
    }
  }

  let frameworks: Framework[] = [];
  const frameworkInfos: FrameworkInfo[] = [];

  const nextJsDirPath = await detectNextJsDirPathFromConfig();

  if (nextJsDirPath) {
    frameworks = await listFrameworks({ projectDir: nextJsDirPath });
    frameworks.map((framework) => {
      frameworkInfos.push({
        id: framework.id,
        name: framework.name,
        dirPath: nextJsDirPath,
      });
    });
  }

  log.trace("Frameworks detected", { frameworkInfos });

  await fs.mkdir(DOT_SHORTEST_DIR_PATH, { recursive: true });

  try {
    const VERSION = 2;

    const projectInfo = {
      metadata: {
        timestamp: Date.now(),
        version: VERSION,
        git: await getGitInfo(),
      },
      data: {
        frameworks: frameworkInfos,
      },
    };

    await fs.writeFile(
      PROJECT_JSON_PATH,
      JSON.stringify(projectInfo, null, 2),
      "utf-8",
    );
    log.info(`Saved project information to ${PROJECT_JSON_PATH}`);

    return projectInfo;
  } catch (error) {
    log.error("Failed to save project information", getErrorDetails(error));
    throw new ShortestError("Failed to save project information");
  }
};

const detectNextJsDirPathFromConfig = async (): Promise<string | undefined> => {
  const log = getLogger();
  const paths = await getPaths(process.cwd());

  const nextDirConfigPaths = paths
    .filter((filePath) => /next\.config\.(js|ts|mjs|cjs)$/.test(filePath))
    .map((filePath) => path.dirname(filePath));

  if (nextDirConfigPaths.length > 0) {
    log.trace("Detected Next.js config paths", { nextDirConfigPaths });
    const nextNamedDir = nextDirConfigPaths.find((dirPath) =>
      /next/i.test(dirPath),
    );
    return path.join(process.cwd(), nextNamedDir || nextDirConfigPaths[0]);
  }

  return undefined;
};
