import { execSync } from "child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import { detect, resolveCommand } from "package-manager-detector";
import pc from "picocolors";
import { CONFIG_FILENAME, ENV_LOCAL_FILENAME } from "../../constants";
import { addToEnv } from "../../utils/add-to-env";
import { addToGitignore } from "../../utils/add-to-gitignore";

export default async function main() {
  console.log(pc.blue("Setting up Shortest..."));

  try {
    const packageJson = await getPackageJson();
    if (
      packageJson?.dependencies?.["@antiwork/shortest"] ||
      packageJson?.devDependencies?.["@antiwork/shortest"]
    ) {
      console.log(pc.green("✔ Package already installed"));
      return;
    } else {
      console.log("Installing @antiwork/shortest...");
      const installCmd = await getInstallCmd();
      execSync(installCmd, { stdio: "inherit" });
      console.log(pc.green("✔ Dependencies installed"));
    }

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
      ".shortest/",
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
    process.exit(1);
  }
}

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

  const command = resolveCommand(packageManager.agent, "install", [
    "@antiwork/shortest",
    "--save-dev",
  ]);

  if (!command) {
    throw new Error(`Unsupported package manager: ${packageManager.agent}`);
  }

  const cmdString = `${command.command} ${command.args.join(" ")}`;
  console.log(pc.dim(cmdString));

  return cmdString;
};
