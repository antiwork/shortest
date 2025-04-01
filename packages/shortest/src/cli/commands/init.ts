import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { Writable } from "node:stream";
import { join } from "path";
import type { Readable } from "stream";
import { select, input, confirm, password } from "@inquirer/prompts";
import { ListrInquirerPromptAdapter } from "@listr2/prompt-adapter-inquirer";
import { Command, Option } from "commander";
import {
  Listr,
  SimpleRenderer,
  ListrTaskWrapper as TaskWrapper,
  DefaultRenderer,
} from "listr2";
import { detect, resolveCommand } from "package-manager-detector";
import pc from "picocolors";
import { generateConfigFile } from "./init/generate-config-file";
import { DOT_SHORTEST_DIR_NAME } from "@/cache";
import { executeCommand } from "@/cli/utils/command-builder";
import { CONFIG_FILENAME, ENV_LOCAL_FILENAME } from "@/constants";
import {
  AppAnalyzer,
  detectSupportedFramework,
  FrameworkInfo,
} from "@/core/app-analyzer";
import { detectFramework } from "@/core/framework-detector";
import { TestGenerator } from "@/core/test-generator";
import { TestPlanner } from "@/core/test-planner";
import { getLogger } from "@/log";
import { LOG_LEVELS } from "@/log/config";
import { testPatternSchema } from "@/types/config";
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
  supportedFrameworkInfo: FrameworkInfo | null;
  shortestLoginEmail: string;
  shortestLoginPassword: string;
}

export const executeInitCommand = async () => {
  const tasks = new Listr<Ctx>(
    [
      {
        title: "[🧪 Experimental Next.js] Confirm sample test file generation",
        task: async (ctx, task) =>
          (ctx.generateSampleTestFile = await task
            .prompt(ListrInquirerPromptAdapter)
            .run(confirm, {
              message:
                "Do you want to generate a sample test file after installation? This is an experimental feature for Next.js projects.",
              default: true,
            })),
      },
      {
        title: "Install Shortest",
        task: (_, task): Listr =>
          task.newListr(
            [
              {
                title: "Checking for existing installation",
                task: async (ctx, task): Promise<void> => {
                  const packageJson = await getPackageJson();
                  ctx.alreadyInstalled = !!(
                    packageJson?.dependencies?.["@antiwork/shortest"] ||
                    packageJson?.devDependencies?.["@antiwork/shortest"]
                  );
                  if (ctx.alreadyInstalled) {
                    task.title = `Shortest is already installed`;
                  } else {
                    task.title =
                      "Shortest is not installed, starting installation.";
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
                          ctx.envFile = new EnvFile(
                            process.cwd(),
                            ENV_LOCAL_FILENAME,
                          );
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
                          task.newListr(
                            (parent) => [
                              {
                                title: "Checking for Anthropic API key",
                                task: async (ctx, _) => {
                                  ctx.anthropicApiKeyExists =
                                    ctx.envFile.keyExists("ANTHROPIC_API_KEY");
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
                                enabled: (ctx): boolean =>
                                  !ctx.anthropicApiKeyExists,
                                task: async (ctx, task) =>
                                  (ctx.anthropicApiKeyValue = await task
                                    .prompt(ListrInquirerPromptAdapter)
                                    .run(password, {
                                      message: `Enter value for ${ctx.anthropicApiKeyName}`,
                                      mask: true,
                                    })),
                              },
                              {
                                title: "Saving API key",
                                enabled: (ctx): boolean =>
                                  !!ctx.anthropicApiKeyValue,
                                task: async (ctx, _) => {
                                  const keyAdded = await ctx.envFile.add({
                                    key: ctx.anthropicApiKeyName,
                                    value: ctx.anthropicApiKeyValue,
                                  });
                                  if (keyAdded) {
                                    parent.title = `${ctx.anthropicApiKeyName} added`;
                                  } else {
                                    parent.title = `${ctx.anthropicApiKeyName} already exists, skipped`;
                                  }
                                },
                              },
                            ],
                            {
                              rendererOptions: {
                                collapseSubtasks: true,
                              },
                            },
                          ),
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
                                    message: `Enter value for SHORTEST_LOGIN_EMAIL. Skip if the application does not require authentication.`,
                                  })),
                            },
                            {
                              title: "Saving SHORTEST_LOGIN_EMAIL key",
                              skip: (ctx): boolean => !ctx.shortestLoginEmail,
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
                              skip: (ctx): boolean => !ctx.shortestLoginEmail,
                              task: async (ctx, task) =>
                                (ctx.shortestLoginPassword = await task
                                  .prompt(ListrInquirerPromptAdapter)
                                  .run(input, {
                                    message: `Enter value for SHORTEST_LOGIN_PASSWORD`,
                                  })),
                            },
                            {
                              title: "Saving SHORTEST_LOGIN_PASSWORD key",
                              skip: (ctx): boolean =>
                                !ctx.shortestLoginPassword,
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
                task: async (ctx, task) => {
                  const testPattern = ctx.generateSampleTestFile
                    ? "shortest/**/*.test.ts"
                    : testPatternSchema._def.defaultValue();
                  await generateConfigFile(
                    join(process.cwd(), CONFIG_FILENAME),
                    {
                      testPattern,
                    },
                  );
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
                    throw new ShortestError(
                      `Failed to update .gitignore: ${resultGitignore.error}`,
                    );
                  }

                  task.title = `.gitignore ${resultGitignore.wasCreated ? "created" : "updated"}`;
                },
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
        title: "Generate sample test file",
        skip: (ctx): boolean => !ctx.generateSampleTestFile,
        task: async (_, task): Promise<Listr> =>
          task.newListr(
            [
              {
                title: "Detecting Next.js framework",
                task: async (ctx, task) => {
                  await taskWithCustomLogOutput(task, async () => {
                    await detectFramework({ force: true });
                    try {
                      ctx.supportedFrameworkInfo =
                        await detectSupportedFramework();
                      task.title = `${ctx.supportedFrameworkInfo.name} framework detected`;
                    } catch (error) {
                      if (!(error instanceof ShortestError)) throw error;
                      task.title = `Next.js framework not detected (${error.message})`;
                    }
                  });
                },
                rendererOptions: {
                  bottomBar: 5,
                },
              },
              {
                title: "Analyzing the codebase",
                enabled: (ctx): boolean => !!ctx.supportedFrameworkInfo,
                task: async (ctx, task) => {
                  await taskWithCustomLogOutput(task, async () => {
                    const supportedFrameworkInfo = assertDefined(
                      ctx.supportedFrameworkInfo,
                    );
                    const analyzer = new AppAnalyzer(supportedFrameworkInfo);
                    await analyzer.execute({ force: true });
                  });
                  task.title = "Analysis complete";
                },
                rendererOptions: {
                  bottomBar: 5,
                },
              },
              {
                title: "Creating test plans",
                enabled: (ctx): boolean => !!ctx.supportedFrameworkInfo,
                task: async (ctx, task) => {
                  await taskWithCustomLogOutput(task, async () => {
                    const supportedFrameworkInfo = assertDefined(
                      ctx.supportedFrameworkInfo,
                    );
                    const planner = new TestPlanner(supportedFrameworkInfo);
                    await planner.execute({ force: true });
                    task.title = `Test planning complete`;
                  });
                },
                rendererOptions: {
                  bottomBar: 5,
                },
              },
              {
                title: "Generating test file",
                enabled: (ctx): boolean => !!ctx.supportedFrameworkInfo,
                task: async (ctx, task) => {
                  await taskWithCustomLogOutput(task, async () => {
                    const supportedFrameworkInfo = assertDefined(
                      ctx.supportedFrameworkInfo,
                    );
                    const generator = new TestGenerator(
                      process.cwd(),
                      supportedFrameworkInfo,
                    );
                    await generator.execute({ force: true });
                    task.title = "Test file generated";
                  });
                },
                rendererOptions: {
                  bottomBar: 5,
                },
              },
            ],
            {
              rendererOptions: {
                collapseSubtasks: false,
              },
            },
          ),
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
    if (tasks.ctx.generateSampleTestFile) {
      console.log(pc.green("\nSetup complete!"));
      console.log("Run tests with: npx/pnpm shortest");
    } else {
      console.log(pc.green("\nInitialization complete! Next steps:"));
      console.log("1. Create your first test file: example.test.ts");
      console.log("2. Run tests with: npx/pnpm shortest example.test.ts");
    }
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

export const taskWithCustomLogOutput = <T>(
  task: TaskWrapper<Ctx, typeof DefaultRenderer, typeof SimpleRenderer>,
  callback: () => Promise<T> | T,
): Promise<T> => {
  const log = getLogger();
  const originalFormat = log.config.format;
  const originalLevel = log.config.level;

  log.config.level = "trace";
  const streamAdapter = new Writable({
    write(chunk, _encoding, callback) {
      task.stdout().write(chunk.toString());
      callback();
    },
  });

  log.setOutputStream(streamAdapter);

  try {
    const result = callback();
    return Promise.resolve(result).then((value) => {
      log.resetOutputStream();
      log.config.format = originalFormat;
      log.config.level = originalLevel;
      return value;
    });
  } catch (error) {
    log.resetOutputStream();
    log.config.format = originalFormat;
    log.config.level = originalLevel;
    throw error;
  }
};
