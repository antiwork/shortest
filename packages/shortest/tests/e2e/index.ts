import fs from "node:fs";
import path from "node:path";
import { describe, test, before } from "node:test";
import { fileURLToPath } from "node:url";
import { glob } from "glob";
import pc from "picocolors";
import { initializeConfig } from "@/index";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const findMonorepoRoot = (startDir: string): string => {
  let currentDir = startDir;
  while (currentDir !== path.parse(currentDir).root) {
    const pkgJsonPath = path.join(currentDir, "package.json");
    if (fs.existsSync(pkgJsonPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
      // Check if this is the root workspace package.json
      if (pkg.workspaces || pkg.private) {
        return currentDir;
      }
    }
    currentDir = path.dirname(currentDir);
  }
  throw new Error(
    "Could not find monorepo root (no workspace package.json found)",
  );
};

const projectRoot = findMonorepoRoot(__dirname);

/**
 * E2E Test Runner
 *
 * Convention:
 * - Place test files in this directory with pattern: test-*.ts
 * - Each test file must export an async main() function
 * - Test name is derived from filename (test-foo.ts -> "Foo")
 * - Use skip() to temporarily skip a test
 *
 * Example:
 * ```typescript
 * // test-browser.ts
 * export async function main({ skip }) {
 *   if (needsMoreWork) skip("Not ready yet");
 *
 *   // Your test code here
 * }
 * ```
 */
describe("End-to-end tests", async () => {
  let isSetupComplete = false;

  before(async () => {
    try {
      console.log(pc.cyan("\n🚀 Initializing test environment..."));
      console.log(pc.cyan(`Looking for config in: ${projectRoot}`));
      await initializeConfig({ configDir: projectRoot });
      isSetupComplete = true;
    } catch (error) {
      console.error(pc.red("\n❌ Failed to initialize config:"), error);
      process.exit(1); // Exit early on setup failure
    }
  });

  const testFiles = await glob("test-*.ts", {
    cwd: __dirname,
    absolute: true,
  });

  testFiles.sort();

  for (const file of testFiles) {
    const testName = path.basename(file, ".ts").replace("test-", "");
    const formattedName = testName.charAt(0).toUpperCase() + testName.slice(1);

    test(formattedName, async (t) => {
      if (!isSetupComplete) {
        t.skip("Setup failed");
        return;
      }

      const module = await import(file);

      if (typeof module.main !== "function") {
        throw new Error(
          `No main() function exported from ${file}. Each test file must export an async main() function.`,
        );
      }

      // Pass skip function to the test
      await module.main({
        skip: (reason?: string) => t.skip(reason || "Test skipped"),
      });
    });
  }
});
