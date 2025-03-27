import fs from "fs/promises";
import { createRequire } from "module";
import path from "path";
import * as t from "@babel/types";
import prettier from "prettier";
import { TestPlan, TestPlanner } from "../test-planner";
import { DOT_SHORTEST_DIR_PATH, SHORTEST_DIR_PATH } from "@/cache";
import { getLogger } from "@/log";
import { getErrorDetails } from "@/utils/errors";

const require = createRequire(import.meta.url);
const generate = require("@babel/generator").default;

export class TestGenerator {
  private rootDir: string;
  private framework: string;
  private log = getLogger();

  private readonly outputPath: string;
  private readonly TEST_FILE_NAME = "functional.test.ts";
  private readonly frameworkDir: string;

  constructor(rootDir: string, framework: string) {
    this.rootDir = rootDir;
    this.framework = framework;
    this.frameworkDir = path.join(DOT_SHORTEST_DIR_PATH, this.framework);
    this.outputPath = path.join(SHORTEST_DIR_PATH, this.TEST_FILE_NAME);
  }

  public async execute(options: { force?: boolean } = {}): Promise<void> {
    this.log.trace("Generating tests...", { framework: this.framework });

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
    const testPlans = await this.getTestPlans();

    const importStatement = t.importDeclaration(
      [t.importSpecifier(t.identifier("shortest"), t.identifier("shortest"))],
      t.stringLiteral("@antiwork/shortest"),
    );

    const testStatements = testPlans
      .map((plan) => {
        const statements: t.Statement[] = [];

        const shortestCall = t.callExpression(t.identifier("shortest"), [
          t.stringLiteral(plan.steps[0].statement),
        ]);

        const expectChain = plan.steps.slice(1).reduce((acc, step) => {
          const expectCall = t.callExpression(
            t.memberExpression(acc, t.identifier("expect")),
            [t.stringLiteral(step.statement)],
          );
          return expectCall;
        }, shortestCall);

        statements.push(t.expressionStatement(expectChain));
        return statements;
      })
      .flat()
      .reduce((acc: t.Statement[], stmt, i) => {
        acc.push(stmt);
        if (i < testPlans.length - 1) {
          acc.push(t.emptyStatement());
        }
        return acc;
      }, []);

    const program = t.program([importStatement, ...testStatements]);
    const output = generate(program, { retainLines: true, compact: false });

    try {
      await fs.mkdir(SHORTEST_DIR_PATH, { recursive: true });

      const prettierConfig = await prettier.resolveConfig(this.rootDir);
      const formattedCode = await prettier.format(output.code, {
        ...prettierConfig,
        parser: "typescript",
        filepath: this.outputPath,
      });

      await fs.writeFile(this.outputPath, formattedCode);
      this.log.info("Test file generated successfully", {
        path: this.outputPath,
      });
    } catch (error) {
      this.log.error("Failed to write tests to file", getErrorDetails(error));
      throw error;
    }
  }

  private async getTestPlans(): Promise<TestPlan[]> {
    const testPlanJsonPath = path.join(
      this.frameworkDir,
      TestPlanner.TEST_PLAN_FILE_NAME,
    );
    const testPlanJson = await fs.readFile(testPlanJsonPath, "utf-8");
    return JSON.parse(testPlanJson).data.testPlans;
  }
}
