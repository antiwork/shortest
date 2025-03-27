import fs from "fs/promises";
import path from "path";
import { generateText } from "ai";
import { z } from "zod";
import { SYSTEM_PROMPT } from "./system-prompt";
import { createProvider } from "@/ai/provider";
import { DOT_SHORTEST_DIR_PATH } from "@/cache";
import { getExistingAnalysis } from "@/core/app-analyzer";
import { getConfig, initializeConfig } from "@/index";
import { getLogger } from "@/log";
import { getErrorDetails } from "@/utils/errors";
import { getGitInfo, GitInfo } from "@/utils/get-git-info";

const TestPlanSchema = z.object({
  testPlans: z.array(
    z.object({
      steps: z.array(
        z.object({
          statement: z.string(),
          requiresAuth: z.boolean().optional(),
        }),
      ),
    }),
  ),
});

// eslint-disable-next-line zod/require-zod-schema-types
export type TestPlan = z.infer<typeof TestPlanSchema>["testPlans"][number];

export interface TestPlanInfo {
  metadata: {
    timestamp: number;
    version: number;
    git: GitInfo;
  };
  data: {
    testPlans: TestPlan[];
  };
}

export class TestPlanner {
  public static readonly TEST_PLAN_FILE_NAME = "test-plan.json";

  private rootDir: string;
  private framework: string;
  private log = getLogger();

  private readonly TEST_PLAN_VERSION = 1;
  private readonly frameworkDir: string;

  constructor(rootDir: string, framework: string) {
    this.rootDir = rootDir;
    this.framework = framework;
    this.frameworkDir = path.join(DOT_SHORTEST_DIR_PATH, this.framework);
  }

  public async execute(options: { force?: boolean } = {}): Promise<TestPlan[]> {
    this.log.trace("Executing test plan...", { framework: this.framework });

    if (!options.force) {
      const existingTestPlanInfo = await this.getExistingTestPlans();
      if (existingTestPlanInfo) {
        this.log.trace("Using existing test plan from cache");
        return existingTestPlanInfo.data.testPlans;
      }
    }

    const testPlans = await this.createTestPlans();
    await this.saveTestPlansToFile(testPlans);

    return testPlans;
  }

  private async getExistingTestPlans(): Promise<TestPlanInfo | null> {
    try {
      const frameworkDir = path.join(DOT_SHORTEST_DIR_PATH, this.framework);
      const testPlanJsonPath = path.join(
        frameworkDir,
        TestPlanner.TEST_PLAN_FILE_NAME,
      );

      try {
        await fs.access(testPlanJsonPath);
      } catch {
        return null;
      }

      const testPlanJson = await fs.readFile(testPlanJsonPath, "utf-8");
      return JSON.parse(testPlanJson);
    } catch (error) {
      this.log.trace(
        "Failed to read existing analysis",
        getErrorDetails(error),
      );
      return null;
    }
  }

  private async createTestPlans(): Promise<TestPlan[]> {
    await initializeConfig({});

    const analysis = await getExistingAnalysis(this.framework);

    const model = createProvider(getConfig().ai);

    this.log.trace("Making AI request to generate test plans");
    const resp = await generateText({
      system: SYSTEM_PROMPT,
      model,
      prompt: `Generate a test plan for the attached analysis: ${JSON.stringify(
        analysis,
      )}`,
    });

    const rawTestPlans = JSON.parse(resp.text);
    const testPlans = TestPlanSchema.parse(rawTestPlans).testPlans;

    return testPlans;
  }

  private async saveTestPlansToFile(testPlans: TestPlan[]): Promise<void> {
    try {
      await fs.mkdir(this.frameworkDir, { recursive: true });
      const testPlanJsonPath = path.join(this.frameworkDir, "test-plan.json");

      const output = {
        metadata: {
          timestamp: Date.now(),
          version: this.TEST_PLAN_VERSION,
          git: await getGitInfo(),
        },
        data: {
          testPlans,
        },
      };

      await fs.writeFile(testPlanJsonPath, JSON.stringify(output, null, 2));
      this.log.trace(`Test plan saved to ${testPlanJsonPath}`);
    } catch (error) {
      this.log.error(
        "Failed to save test plans to file",
        getErrorDetails(error),
      );
      throw error;
    }
  }
}
