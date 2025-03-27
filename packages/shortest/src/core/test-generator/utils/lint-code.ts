import { createRequire } from "module";
import { getLogger } from "@/log";
import { getErrorDetails } from "@/utils/errors";

const require = createRequire(import.meta.url);

export const lintCode = async (
  code: string,
  rootDir: string,
): Promise<string> => {
  const log = getLogger();
  log.trace("Linting code using ESLint");
  let lintedCode = code;
  try {
    log.trace("Loading ESLint", { rootDir: rootDir });
    const eslintPath = require.resolve("eslint", {
      paths: [rootDir],
    });
    const { ESLint } = await import(eslintPath);

    const customConfig = {
      rules: {
        "padding-line-between-statements": [
          "error",
          { blankLine: "always", prev: "expression", next: "expression" },
          { blankLine: "always", prev: "import", next: "*" },
        ],
      },
    };

    const eslint = new ESLint({
      fix: true,
      cwd: rootDir,
      overrideConfig: customConfig,
    });

    const results = await eslint.lintText(code);

    if (results[0]?.output) {
      lintedCode = results[0].output;
      log.trace("ESLint applied fixes to the code");
    } else {
      log.trace("ESLint found no issues to fix");
    }

    if (results[0]?.messages?.length > 0) {
      const issueCount = results[0].messages.length;
      log.trace(
        `ESLint found ${issueCount} issues that couldn't be automatically fixed`,
      );
    }
  } catch (error) {
    log.error(
      "Could not use ESLint to lint code, skipping linting",
      getErrorDetails(error),
    );
  }

  return lintedCode;
};
