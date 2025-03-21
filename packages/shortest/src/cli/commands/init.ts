import { execSync } from "child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { Command, Option } from "commander";
import { detect, resolveCommand } from "package-manager-detector";
import pc from "picocolors";
import { DOT_SHORTEST_DIR_NAME } from "@/cache";
import { executeCommand } from "@/cli/utils/command-builder";
import { CONFIG_FILENAME, ENV_LOCAL_FILENAME } from "@/constants";
import { LOG_LEVELS } from "@/log/config";
import { addToEnv } from "@/utils/add-to-env";
import { addToGitignore } from "@/utils/add-to-gitignore";
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
    await executeCommand(this.name(), this.optsWithGlobals(), async () =>
      executeInitCommand(),
    );
  });

export const executeInitCommand = async () => {
  console.log(pc.blue("Setting up Shortest..."));

  try {
    const packageJson = await getPackageJson();
    if (
      packageJson?.dependencies?.["@antiwork/shortest"] ||
      packageJson?.devDependencies?.["@antiwork/shortest"]
    ) {
      console.log(pc.green("✔ Package already installed"));
      return;
    }
    console.log("Installing @antiwork/shortest...");
    const installCmd = await getInstallCmd();
    execSync(installCmd, { stdio: "inherit" });
    console.log(pc.green("✔ Dependencies installed"));

    const configPath = join(process.cwd(), CONFIG_FILENAME);
    const exampleConfigPath = join(
      fileURLToPath(new URL("../../src", import.meta.url)),
      `${CONFIG_FILENAME}.example`,
    );

    const exampleConfig = await readFile(exampleConfigPath, "utf8");
    await writeFile(configPath, exampleConfig, "utf8");
    console.log(pc.green(`✔ ${CONFIG_FILENAME} created`));

    const envResult = await addToEnv(process.cwd(), {
      ANTHROPIC_API_KEY: {
        value: "your_value_here",
        comment: "Shortest variables",
      },
    });
    if (envResult.error) {
      console.error(
        pc.red(`Failed to update ${ENV_LOCAL_FILENAME}`),
        envResult.error,
      );
    } else if (envResult.added.length > 0) {
      const added = envResult.added.join(", ");
      const skipped = envResult.skipped.join(", ");
      const detailsString = [
        added ? `${added} added` : "",
        skipped ? `${skipped} skipped` : "",
      ]
        .filter(Boolean)
        .join(", ");
      console.log(
        pc.green(
          `✔ ${ENV_LOCAL_FILENAME} ${envResult.wasCreated ? "created" : "updated"} (${detailsString})`,
        ),
      );
    }

    const resultGitignore = await addToGitignore(process.cwd(), [
      ".env*.local",
      `${DOT_SHORTEST_DIR_NAME}/`,
    ]);
    if (resultGitignore.error) {
      console.error(
        pc.red("Failed to update .gitignore"),
        resultGitignore.error,
      );
    } else {
      console.log(
        pc.green(
          `✔ .gitignore ${resultGitignore.wasCreated ? "created" : "updated"}`,
        ),
      );
    }

    console.log(pc.green("\nInitialization complete! Next steps:"));
    console.log(`1. Update ${ENV_LOCAL_FILENAME} with your values`);
    console.log("2. Create your first test file: example.test.ts");
    console.log("3. Run tests with: npx/pnpm test example.test.ts");
  } catch (error) {
    console.error(pc.red("Initialization failed:"), error);
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
  console.log(pc.dim(cmdString));

  return cmdString;
};
