import fs from "fs/promises";
import { createRequire } from "module";
import path from "path";
import * as t from "@babel/types";
import { DOT_SHORTEST_DIR_PATH } from "@/cache";
import { SHORTEST_NAME } from "@/cli/commands/shortest";
import { FrameworkInfo } from "@/core/app-analyzer";
import { formatCode } from "@/core/test-generator/utils/format-code";
import { lintCode } from "@/core/test-generator/utils/lint-code";
import { TestPlan, TestPlanner } from "@/core/test-planner";
import { getLogger } from "@/log";
import { getErrorDetails } from "@/utils/errors";

export const SHORTEST_DIR_NAME = "shortest";
export const SHORTEST_DIR_PATH = path.join(process.cwd(), SHORTEST_DIR_NAME);
const SHORTEST_EXPECT_NAME = "expect";

const require = createRequire(import.meta.url);
const generate = require("@babel/generator").default;

export class TestGenerator {
  private readonly rootDir: string;
  private readonly frameworkInfo: FrameworkInfo;
  private readonly log = getLogger();
  private readonly outputPath: string;
  private readonly TEST_FILE_NAME = "functional.test.ts";
  private readonly cacheFrameworkDir: string;

  constructor(rootDir: string, frameworkInfo: FrameworkInfo) {
    this.rootDir = rootDir;
    this.frameworkInfo = frameworkInfo;
    this.cacheFrameworkDir = path.join(
      DOT_SHORTEST_DIR_PATH,
      this.frameworkInfo.id,
    );
    this.outputPath = path.join(SHORTEST_DIR_PATH, this.TEST_FILE_NAME);
  }

  public async execute(options: { force?: boolean } = {}): Promise<void> {
    this.log.trace("Generating tests...", { framework: this.frameworkInfo });

    if (!options.force) {
      if (await this.testFileExists()) {
        this.log.trace("Test file already exists, skipping generation", {
          path: this.outputPath,
        });
        return;
      }
    }

    await this.generateTestFile();
  }

  private async testFileExists(): Promise<boolean> {
    try {
      await fs.access(this.outputPath);
      return true;
    } catch {
      return false;
    }
  }

  private async generateTestFile(): Promise<void> {
    const rawFileContent = await this.generateRawFileOutput();
    const formattedCode = await formatCode(
      rawFileContent,
      this.frameworkInfo.dirPath,
    );
    const lintedCode = await lintCode(
      formattedCode,
      this.frameworkInfo.dirPath,
    );

    try {
      await fs.mkdir(SHORTEST_DIR_PATH, { recursive: true });
      await fs.writeFile(this.outputPath, lintedCode);
      this.log.info("Test file generated successfully", {
        path: this.outputPath,
      });
    } catch (error) {
      this.log.error("Failed to write tests to file", getErrorDetails(error));
      throw error;
    }
  }

  private async generateRawFileOutput(): Promise<string> {
    const testPlans = await this.getTestPlans();

    const importStatement = t.importDeclaration(
      [
        t.importSpecifier(
          t.identifier(SHORTEST_NAME),
          t.identifier(SHORTEST_NAME),
        ),
      ],
      t.stringLiteral("@antiwork/shortest"),
    );

    const testStatements = testPlans
      .map((plan) => {
        const statements: t.Statement[] = [];

        const statementArgs: any[] = [t.stringLiteral(plan.steps[0])];

        if (plan.options?.requiresAuth) {
          statementArgs.push(
            t.objectExpression([
              t.objectProperty(
                t.identifier("email"),
                t.memberExpression(
                  t.memberExpression(
                    t.identifier("process"),
                    t.identifier("env"),
                  ),
                  t.identifier("SHORTEST_LOGIN_EMAIL"),
                ),
              ),
              t.objectProperty(
                t.identifier("password"),
                t.memberExpression(
                  t.memberExpression(
                    t.identifier("process"),
                    t.identifier("env"),
                  ),
                  t.identifier("SHORTEST_LOGIN_PASSWORD"),
                ),
              ),
            ]),
          );
        }

        const shortestCall = t.callExpression(
          t.identifier(SHORTEST_NAME),
          statementArgs,
        );

        const expectChain = plan.steps.slice(1).reduce((acc, step) => {
          const expectCall = t.callExpression(
            t.memberExpression(acc, t.identifier(SHORTEST_EXPECT_NAME)),
            [t.stringLiteral(step)],
          );
          return expectCall;
        }, shortestCall);

        statements.push(t.expressionStatement(expectChain));
        return statements;
      })
      .flat();

    const program = t.program([importStatement, ...testStatements]);

    return generate(program, {
      retainLines: true,
      compact: false,
    }).code;
  }

  private async getTestPlans(): Promise<TestPlan[]> {
    const testPlanJsonPath = path.join(
      this.cacheFrameworkDir,
      TestPlanner.TEST_PLAN_FILE_NAME,
    );
    const testPlanJson = await fs.readFile(testPlanJsonPath, "utf-8");
    return JSON.parse(testPlanJson).data.testPlans;
  }
}
