import fs from "fs/promises";
import { createRequire } from "module";
import path from "path";
import { getLogger } from "@/log";
import { getErrorDetails } from "@/utils/errors";

const require = createRequire(import.meta.url);

export const formatCode = async (
  code: string,
  rootDir: string,
): Promise<string> => {
  const log = getLogger();
  log.trace("Formatting code using Prettier", { rootDir: rootDir });
  let formattedCode = code;
  try {
    const prettierPath = require.resolve("prettier", {
      paths: [rootDir],
    });
    let prettier = await import(prettierPath);

    if (prettier.default) {
      prettier = prettier.default;
    }

    let prettierConfig = await prettier.resolveConfig(rootDir);

    if (!prettierConfig) {
      log.trace("No prettier config found, loading from .prettierrc");
      const prettierrcPath = path.join(rootDir, ".prettierrc");
      const configContent = await fs.readFile(prettierrcPath, "utf8");
      prettierConfig = JSON.parse(configContent);
      log.trace("Loaded .prettierrc directly", { prettierConfig });
    }

    if (prettierConfig) {
      formattedCode = await prettier.format(formattedCode, {
        ...prettierConfig,
        parser: "typescript",
      });
    }
  } catch (error) {
    log.error(
      "Could not use Prettier to format code, skipping formatting",
      getErrorDetails(error),
    );
  }

  return formattedCode;
};
