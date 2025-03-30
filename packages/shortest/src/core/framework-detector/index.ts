import { existsSync } from "fs";
import fs from "fs/promises";
import path from "path";
import { listFrameworks } from "@netlify/framework-info";
import { Framework } from "@netlify/framework-info/lib/types";
import { DOT_SHORTEST_DIR_PATH } from "@/cache";
import { getPackageJson } from "@/cli/commands/init";
import { FrameworkInfo } from "@/core/app-analyzer";
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

const detectNextJsPathFromPackageJson = (
  packageJson: any,
): string | undefined => {
  if (!packageJson) return undefined;

  if (packageJson.workspaces) {
    // Find any workspace that contains 'next'
    const nextWorkspace = packageJson.workspaces.find((workspace: string) =>
      workspace.includes("next"),
    );

    if (nextWorkspace) {
      // Handle pattern with wildcards
      if (nextWorkspace.endsWith("/*")) {
        const basePath = nextWorkspace.replace("/*", "");
        // Try to find the most specific path - prefer 'nextjs' over just 'next'
        return path.join(process.cwd(), `${basePath}/nextjs`);
      }

      // Use the exact workspace path found
      return path.join(process.cwd(), nextWorkspace);
    }
  }

  return undefined;
};

const detectNextJsPathFromConfig = async (): Promise<FrameworkInfo | undefined> => {
  const paths = await getPaths(process.cwd());

};

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
  let frameworkInfos: FrameworkInfo[] = [];

  frameworks = await listFrameworks({ projectDir: process.cwd() });
  frameworks.map((framework) => {
    frameworkInfos.push({
      id: framework.id,
      name: framework.name,
      dirPath: process.cwd(),
    });
  });

  if (frameworks.length === 0) {
    const packageJson = await getPackageJson();
    const possibleNextJsPath = detectNextJsPathFromPackageJson(packageJson);
    if (possibleNextJsPath) {
      frameworks = await listFrameworks({ projectDir: possibleNextJsPath });
      frameworks.map((framework) => {
        frameworkInfos.push({
          id: framework.id,
          name: framework.name,
          dirPath: possibleNextJsPath,
        });
      });
    }
  }

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
