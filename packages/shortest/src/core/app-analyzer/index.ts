import fs from "fs/promises";
import path from "path";
import { DOT_SHORTEST_DIR_PATH } from "@/cache";
import { NextJsAnalyzer } from "@/core/app-analyzer/next-js-analyzer";
import { AppAnalysis } from "@/core/app-analyzer/types";
import { getProjectInfo } from "@/core/framework-detector";
import { getLogger } from "@/log";
import { ShortestError, getErrorDetails } from "@/utils/errors";

export interface FrameworkInfo {
  id: string;
  name: string;
  dirPath: string;
}

export const SUPPORTED_FRAMEWORKS_IDS = ["next"];
// eslint-disable-next-line zod/require-zod-schema-types
export type SupportedFrameworkId = (typeof SUPPORTED_FRAMEWORKS_IDS)[number];

export class AppAnalyzer {
  private readonly frameworkInfo: FrameworkInfo;
  private readonly log = getLogger();

  constructor(frameworkInfo: FrameworkInfo) {
    this.frameworkInfo = frameworkInfo;
  }

  public async execute(
    options: { force?: boolean } = {},
  ): Promise<AppAnalysis> {
    this.log.trace("Analyzing application...", {
      framework: this.frameworkInfo.id,
    });

    let analysis: AppAnalysis;

    if (!options.force) {
      const existingAnalysis = await getExistingAnalysis(this.frameworkInfo.id);
      if (existingAnalysis) {
        this.log.trace("Using existing analysis from cache");
        return existingAnalysis;
      }
    }

    switch (this.frameworkInfo.id) {
      case "next":
        analysis = await this.analyzeNextJs();
        break;
      default:
        throw new ShortestError(
          `Unsupported framework: ${this.frameworkInfo.id}`,
        );
    }

    this.log.trace(
      `Analysis complete for ${this.frameworkInfo.name} framework`,
    );
    return analysis;
  }

  private async analyzeNextJs(): Promise<AppAnalysis> {
    this.log.trace("Starting Next.js analysis");

    try {
      const nextAnalyzer = new NextJsAnalyzer(this.frameworkInfo);
      const analysis = await nextAnalyzer.execute();

      this.log.trace("Next.js analysis completed successfully");
      return analysis;
    } catch (error) {
      this.log.error(
        "Failed to analyze Next.js application",
        getErrorDetails(error),
      );
      throw new ShortestError("Failed to analyze Next.js application");
    }
  }
}

export const getExistingAnalysis = async (
  frameworkId: SupportedFrameworkId,
): Promise<AppAnalysis | null> => {
  const log = getLogger();
  log.trace("Getting existing analysis", { frameworkId });

  try {
    const cacheFrameworkDir = path.join(DOT_SHORTEST_DIR_PATH, frameworkId);
    const analysisJsonPath = path.join(cacheFrameworkDir, "analysis.json");

    try {
      await fs.access(analysisJsonPath);
    } catch {
      return null;
    }

    const analysisJson = await fs.readFile(analysisJsonPath, "utf-8");
    const analysisData = JSON.parse(analysisJson);

    return analysisData.data;
  } catch (error) {
    log.trace("Failed to read existing analysis", getErrorDetails(error));
    return null;
  }
};

export const detectSupportedFramework = async (): Promise<FrameworkInfo> => {
  const projectInfo = await getProjectInfo();
  const supportedFrameworks = projectInfo.data.frameworks.filter((f) =>
    SUPPORTED_FRAMEWORKS_IDS.includes(f.id),
  );

  if (supportedFrameworks.length === 0) {
    throw new ShortestError(`No supported framework found`);
  }

  if (supportedFrameworks.length > 1) {
    throw new ShortestError(
      `Multiple supported frameworks found: ${supportedFrameworks.map((f) => f.name).join(", ")}`,
    );
  }

  return supportedFrameworks[0];
};
