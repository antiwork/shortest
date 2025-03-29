import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "path";
import type { Readable } from "stream";
import { fileURLToPath } from "url";
import { select, input, confirm } from "@inquirer/prompts";
import { ListrInquirerPromptAdapter } from "@listr2/prompt-adapter-inquirer";
import { Command, Option } from "commander";
import { delay, Listr } from "listr2";
import { detect, resolveCommand } from "package-manager-detector";
import pc from "picocolors";
import { DOT_SHORTEST_DIR_NAME } from "@/cache";
import { executeCommand } from "@/cli/utils/command-builder";
import { CONFIG_FILENAME, ENV_LOCAL_FILENAME } from "@/constants";
import {
  AppAnalyzer,
  detectSupportedFramework,
  SupportedFramework,
} from "@/core/app-analyzer";
import { detectFramework } from "@/core/framework-detector";
import { TestGenerator } from "@/core/test-generator";
import { TestPlanner } from "@/core/test-planner";
import { LOG_LEVELS } from "@/log/config";
import { addToGitignore } from "@/utils/add-to-gitignore";
import { assertDefined } from "@/utils/assert";
import { EnvFile } from "@/utils/env-file";
import { ShortestError } from "@/utils/errors";

export const initCommand = new Command("init")
  .description("Initialize Shortest in current directory")
  .addHelpText(
    "after",
    `
${pc.bold("The command will:")}
- Automatically install the @antiwork/shortest package as a dev dependency if it is not already installed
- Create a default shortest.config.ts file with boilerplate configuration
- Generate a ${ENV_LOCAL_FILENAME} file (unless present) with placeholders for required environment variables, such as ANTHROPIC_API_KEY
- Add ${ENV_LOCAL_FILENAME} and ${DOT_SHORTEST_DIR_NAME} to .gitignore

${pc.bold("Documentation:")}
  ${pc.cyan("https://github.com/antiwork/shortest")}
`,
  );

initCommand
  // This is needed to show in help without calling showGlobalOptions, which would show all global options that
  // are not relevant (e.g. --headless, --target, --no-cache)
  .addOption(
    new Option("--log-level <level>", "Set logging level").choices(LOG_LEVELS),
  )
  .action(async function () {
    await executeCommand(this.name(), this.optsWithGlobals(), async () => {
      await executeInitCommand();
    });
  });

interface Ctx {
  alreadyInstalled: boolean;
  anthropicApiKeyExists: boolean;
  anthropicApiKeyName: string;
  anthropicApiKeyValueNeeded: boolean;
  anthropicApiKeyValue: string;
  envFile: EnvFile;
  generateSampleTestFile: boolean;
  supportedFramework: SupportedFramework | null;
}

export const executeInitCommand = async () => {
  const tasks = new Listr<Ctx>(
    [
      {
        title: "Checking for existing installation",
        task: async (ctx, task): Promise<void> => {
          await delay(5000);
          const packageJson = await getPackageJson();
          ctx.alreadyInstalled = !!(
            packageJson?.dependencies?.["@antiwork/shortest"] ||
            packageJson?.devDependencies?.["@antiwork/shortest"]
          );
          if (ctx.alreadyInstalled) {
            task.title = `Shortest is already installed`;
          } else {
            task.title = "Shortest is not installed, starting installation.";
          }
        },
      },
      {
        title: "Installing dependencies",
        enabled: (ctx): boolean => !ctx.alreadyInstalled,
        task: async (_, task): Promise<Readable> => {
          const installCmd = await getInstallCmd();
          task.title = `Executing ${installCmd.toString()}`;
          return spawn(installCmd.cmd, installCmd.args).stdout;
        },
        rendererOptions: {
          persistentOutput: true,
          bottomBar: 5,
        },
      },
      {
        title: `Setting up environment variables`,
        enabled: (ctx): boolean => !ctx.alreadyInstalled,
        task: (_, task): Listr =>
          task.newListr(
            [
              {
                title: `Checking for ${ENV_LOCAL_FILENAME}`,
                task: async (ctx, task) => {
                  ctx.envFile = new EnvFile(process.cwd(), ENV_LOCAL_FILENAME);
                  if (ctx.envFile.isNewFile()) {
                    task.title = `Creating ${ENV_LOCAL_FILENAME}`;
                  } else {
                    task.title = `Found ${ENV_LOCAL_FILENAME}`;
                  }
                },
              },
              {
                title: `Adding Anthropic API key`,
                task: async (_, task): Promise<Listr> =>
                  task.newListr([
                    {
                      title: "Checking for Anthropic API key",
                      task: async (ctx, _) => {
                        ctx.anthropicApiKeyExists = ctx.envFile.keyExists(
                          ctx.envFile.keyExists("ANTHROPIC_API_KEY"),
                        );
                      },
                    },
                    {
                      title: "Select Anthropic API key name",
                      task: async (ctx, task) =>
                        (ctx.anthropicApiKeyName = await task
                          .prompt(ListrInquirerPromptAdapter)
                          .run(select, {
                            message: ctx.anthropicApiKeyExists
                              ? "Anthropic API key already exists. Select the name of the key you want to use."
                              : "Select the name of the Anthropic API key you want to use.",
                            choices: [
                              {
                                name: "ANTHROPIC_API_KEY",
                                value: "ANTHROPIC_API_KEY",
                                description: ctx.anthropicApiKeyExists
                                  ? "Use existing API key"
                                  : "Use the default API key name",
                              },
                              {
                                name: "SHORTEST_ANTHROPIC_API_KEY",
                                value: "SHORTEST_ANTHROPIC_API_KEY",
                                description:
                                  "Use a dedicated API key for Shortest",
                              },
                            ],
                          })),
                    },
                    {
                      title: "Enter API key value",
                      enabled: (ctx): boolean => !ctx.anthropicApiKeyExists,
                      task: async (ctx, task) =>
                        (ctx.anthropicApiKeyValue = await task
                          .prompt(ListrInquirerPromptAdapter)
                          .run(input, {
                            message: `Enter value for ${ctx.anthropicApiKeyName}`,
                            required: true,
                          })),
                    },
                    {
                      title: "Saving API key",
                      enabled: (ctx): boolean => !!ctx.anthropicApiKeyValue,
                      task: async (ctx, task) => {
                        const keyAdded = await ctx.envFile.add({
                          key: ctx.anthropicApiKeyName,
                          value: ctx.anthropicApiKeyValue,
                        });
                        if (keyAdded) {
                          task.title = `${ctx.anthropicApiKeyName} added`;
                        } else {
                          task.title = `${ctx.anthropicApiKeyName} already exists, skipped`;
                        }
                      },
                    },
                  ]),
              },
              {
                title: "Adding Shortest login credentials for testing",
                task: async (_, task): Promise<Listr> =>
                  task.newListr([
                    {
                      title: "Enter the email for the test account",
                      task: async (ctx, task) =>
                        (ctx.shortestLoginEmail = await task
                          .prompt(ListrInquirerPromptAdapter)
                          .run(input, {
                            message: `Enter value for SHORTEST_LOGIN_EMAIL`,
                          })),
                    },
                    {
                      title: "Saving SHORTEST_LOGIN_EMAIL key",
                      task: async (ctx, task) => {
                        const keyAdded = await ctx.envFile.add({
                          key: "SHORTEST_LOGIN_EMAIL",
                          value: ctx.shortestLoginEmail,
                        });
                        if (keyAdded) {
                          task.title = `SHORTEST_LOGIN_EMAIL added`;
                        } else {
                          task.title = `SHORTEST_LOGIN_EMAIL already exists, skipped`;
                        }
                      },
                    },
                    {
                      title: "Enter the password for the test account",
                      task: async (ctx, task) =>
                        (ctx.shortestLoginPassword = await task
                          .prompt(ListrInquirerPromptAdapter)
                          .run(input, {
                            message: `Enter value for SHORTEST_LOGIN_PASSWORD`,
                          })),
                    },
                    {
                      title: "Saving SHORTEST_LOGIN_EMAIL key",
                      task: async (ctx, task) => {
                        const keyAdded = await ctx.envFile.add({
                          key: "SHORTEST_LOGIN_PASSWORD",
                          value: ctx.shortestLoginPassword,
                        });
                        if (keyAdded) {
                          task.title = `SHORTEST_LOGIN_PASSWORD added`;
                        } else {
                          task.title = `SHORTEST_LOGIN_PASSWORD already exists, skipped`;
                        }
                      },
                    },
                  ]),
              },
            ],
            {
              rendererOptions: {
                collapseSubtasks: false,
              },
            },
          ),
      },
      {
        title: `Creating ${CONFIG_FILENAME}`,
        enabled: (ctx): boolean => !ctx.alreadyInstalled,
        task: async (_, task) => {
          const configPath = join(process.cwd(), CONFIG_FILENAME);
          const exampleConfigPath = join(
            fileURLToPath(new URL("../../src", import.meta.url)),
            `${CONFIG_FILENAME}.example`,
          );

          const exampleConfig = await readFile(exampleConfigPath, "utf8");
          await writeFile(configPath, exampleConfig, "utf8");
          task.title = `${CONFIG_FILENAME} created.`;
        },
      },
      {
        title: "Updating .gitignore",
        enabled: (ctx): boolean => !ctx.alreadyInstalled,
        task: async (_, task) => {
          const resultGitignore = await addToGitignore(process.cwd(), [
            ".env*.local",
            `${DOT_SHORTEST_DIR_NAME}/`,
          ]);

          if (resultGitignore.error) {
            throw new Error(
              `Failed to update .gitignore: ${resultGitignore.error}`,
            );
          }

          task.title = `.gitignore ${resultGitignore.wasCreated ? "created" : "updated"}`;
        },
      },
      {
        title: "Generating sample test file",
        task: async (ctx, task) =>
          (ctx.generateSampleTestFile = await task
            .prompt(ListrInquirerPromptAdapter)
            .run(confirm, {
              message: "Do you want to generate a sample test file?",
              default: true,
            })),
      },
      {
        title: "Detecting Next.js framework",
        enabled: (ctx): boolean => ctx.generateSampleTestFile,
        task: async (ctx, task) => {
          await detectFramework({ force: true });
          try {
            ctx.supportedFramework = await detectSupportedFramework();
            task.title = `Next.js framework detected`;
          } catch (error) {
            if (!(error instanceof ShortestError)) throw error;
            task.title = `Next.js framework not detected (${error.message})`;
          }
        },
      },
      {
        title: "Analyzing the codebase",
        enabled: (ctx): boolean => !!ctx.supportedFramework,
        task: async (ctx, task) => {
          const supportedFramework = assertDefined(ctx.supportedFramework);
          const analyzer = new AppAnalyzer(process.cwd(), supportedFramework);
          await analyzer.execute({ force: true });
          task.title = "Analysis complete";
        },
        rendererOptions: {
          bottomBar: 5,
        },
      },
      {
        title: "Creating test plans",
        enabled: (ctx): boolean => !!ctx.supportedFramework,
        task: async (ctx, task) => {
          const supportedFramework = assertDefined(ctx.supportedFramework);
          const planner = new TestPlanner(process.cwd(), supportedFramework);
          await planner.execute({ force: true });
          task.title = `Test planning complete`;
        },
      },
      {
        title: "Generating test file",
        enabled: (ctx): boolean => !!ctx.supportedFramework,
        task: async (ctx, task) => {
          const supportedFramework = assertDefined(ctx.supportedFramework);
          const generator = new TestGenerator(
            process.cwd(),
            supportedFramework,
          );
          await generator.execute({ force: true });
          task.title = "Test file generated";
        },
      },
    ],
    {
      renderer: "default",
      exitOnError: true,
      concurrent: false,
      rendererOptions: {
        collapseErrors: false,
      },
    },
  );

  try {
    await tasks.run();
    console.log(pc.green("\nInitialization complete! Next steps:"));
    console.log("2. Create your first test file: example.test.ts");
    console.log("3. Run tests with: npx/pnpm test example.test.ts");
  } catch (error) {
    console.error(pc.red("Initialization failed"));
    throw error;
  }
};

export const getPackageJson = async () => {
  try {
    return JSON.parse(
      await readFile(join(process.cwd(), "package.json"), "utf8"),
    );
  } catch {}
};

export const getInstallCmd = async () => {
  const packageManager = (await detect()) || { agent: "npm", version: "" };
  const packageJson = await getPackageJson();
  if (packageJson?.packageManager) {
    const [name] = packageJson.packageManager.split("@");
    if (["pnpm", "yarn", "bun"].includes(name)) {
      packageManager.agent = name;
    }
  }

  const command = resolveCommand(
    packageManager.agent,
    packageManager.agent === "yarn" ? "add" : "install",
    ["@antiwork/shortest", "--save-dev"],
  );

  if (!command) {
    throw new ShortestError(
      `Unsupported package manager: ${packageManager.agent}`,
    );
  }

  const cmdString = `${command.command} ${command.args.join(" ")}`;

  return {
    cmd: command.command,
    args: command.args,
    toString: () => cmdString,
  };
};
