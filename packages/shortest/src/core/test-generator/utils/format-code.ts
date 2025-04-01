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
      log.trace(
        "No Prettier config found via resolveConfig, checking for config files",
      );

      const prettierConfigMjsPath = path.join(rootDir, "prettier.config.mjs");
      try {
        if (
          await fs
            .stat(prettierConfigMjsPath)
            .then(() => true)
            .catch(() => false)
        ) {
          log.trace("Found prettier.config.mjs, loading config");
          const configModule = await import(`file://${prettierConfigMjsPath}`);
          prettierConfig = configModule.default;
          log.trace("Loaded prettier.config.mjs", { prettierConfig });
        }
      } catch (configError) {
        log.trace(
          "Error loading prettier.config.mjs",
          getErrorDetails(configError),
        );
      }

      if (!prettierConfig) {
        try {
          const prettierrcPath = path.join(rootDir, ".prettierrc");
          if (
            await fs
              .stat(prettierrcPath)
              .then(() => true)
              .catch(() => false)
          ) {
            log.trace("Loading from .prettierrc");
            const configContent = await fs.readFile(prettierrcPath, "utf8");
            prettierConfig = JSON.parse(configContent);
            log.trace("Loaded .prettierrc directly", { prettierConfig });
          }
        } catch (prettierrcError) {
          log.trace(
            "Error loading .prettierrc",
            getErrorDetails(prettierrcError),
          );
        }
      }
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
