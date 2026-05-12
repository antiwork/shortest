import fs from "fs/promises";
import path from "path";
import { renderFailureReport } from "./markdown";
import type {
  FailureReportInput,
  FailureReportOptions,
  ScreenshotAttachment,
} from "./types";

const SCREENSHOT_FILE_PATTERN = /^screenshot-.*\.(png|jpe?g|webp)$/i;

const safeFileName = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "failure-report";

const toDisplayPath = (filePath: string, cwd: string): string => {
  const relativePath = path.relative(cwd, filePath);

  return relativePath &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
    ? relativePath
    : filePath;
};

const readScreenshotFileNames = async (
  screenshotSourceDir?: string,
): Promise<string[]> => {
  if (!screenshotSourceDir) return [];

  try {
    const entries = await fs.readdir(screenshotSourceDir, {
      withFileTypes: true,
    });

    return entries
      .filter(
        (entry) => entry.isFile() && SCREENSHOT_FILE_PATTERN.test(entry.name),
      )
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];

    throw error;
  }
};

const copyScreenshots = async ({
  reportDir,
  safeRunId,
  screenshotSourceDir,
}: {
  reportDir: string;
  safeRunId: string;
  screenshotSourceDir?: string;
}): Promise<ScreenshotAttachment[]> => {
  const screenshotFileNames =
    await readScreenshotFileNames(screenshotSourceDir);
  if (screenshotFileNames.length === 0 || !screenshotSourceDir) return [];

  const screenshotDir = path.join(reportDir, safeRunId, "screenshots");
  await fs.mkdir(screenshotDir, { recursive: true });

  const screenshots: ScreenshotAttachment[] = [];
  for (const fileName of screenshotFileNames) {
    const sourcePath = path.join(screenshotSourceDir, fileName);
    const destinationPath = path.join(screenshotDir, fileName);
    await fs.copyFile(sourcePath, destinationPath);

    screenshots.push({
      fileName,
      markdownPath: path.posix.join(safeRunId, "screenshots", fileName),
    });
  }

  return screenshots;
};

const writeFileAtomically = async (
  filePath: string,
  content: string,
): Promise<void> => {
  const tempPath = path.join(
    path.dirname(filePath),
    `.tmp-${process.pid}-${Date.now()}-${path.basename(filePath)}`,
  );

  try {
    await fs.writeFile(tempPath, content, "utf-8");
    await fs.rename(tempPath, filePath);
  } catch (error) {
    await fs.rm(tempPath, { force: true });
    throw error;
  }
};

export const writeFailureReport = async (
  input: FailureReportInput,
  options: FailureReportOptions,
): Promise<string | null> => {
  if (!options.enabled) return null;

  const cwd = options.cwd ?? process.cwd();
  const reportDir = path.resolve(cwd, options.outputDir);
  const safeRunId = safeFileName(input.runId);
  const reportPath = path.join(reportDir, `${safeRunId}.md`);

  await fs.mkdir(reportDir, { recursive: true });

  const screenshots = await copyScreenshots({
    reportDir,
    safeRunId,
    screenshotSourceDir: input.screenshotSourceDir,
  });
  const report = renderFailureReport({ ...input, screenshots });
  await writeFileAtomically(reportPath, report);

  return toDisplayPath(reportPath, cwd);
};
