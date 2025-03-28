import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "path";
import type { Readable } from "stream";
import { fileURLToPath } from "url";
import { Command, Option } from "commander";
import { Listr } from "listr2";
import { detect, resolveCommand } from "package-manager-detector";
import pc from "picocolors";
import { DOT_SHORTEST_DIR_NAME } from "@/cache";
import { executeCommand } from "@/cli/utils/command-builder";
import { CONFIG_FILENAME, ENV_LOCAL_FILENAME } from "@/constants";
import { LOG_LEVELS } from "@/log/config";
import { addToGitignore } from "@/utils/add-to-gitignore";
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

export const executeInitCommand = async () => {
  const tasks = new Listr(
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
            task.output = `Shortest is already installed`;
          } else {
            task.output = "Shortest is not installed, starting installation.";
          }
        },
        rendererOptions: {
          persistentOutput: true,
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
        },
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
                title: `Adding ANTHROPIC_API_KEY`,
                task: async (ctx, task) => {
                  const keyAdded = await ctx.envFile.add({
                    key: "ANTHROPIC_API_KEY",
                    value: "your_value_here",
                    comment: "Shortest variables",
                  });
                  if (keyAdded) {
                    task.title = `ANTHROPIC_API_KEY added`;
                  } else {
                    task.title = `ANTHROPIC_API_KEY already exists, skipped`;
                  }
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
    ],
    {
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
    console.log(`1. Update ${ENV_LOCAL_FILENAME} with your values`);
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
