import { createRequire } from "module";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "path";
import { fileURLToPath } from "url";
import * as t from "@babel/types";
import { CONFIG_FILENAME } from "@/constants";
import { formatCode } from "@/core/test-generator/utils/format-code";
import { lintCode } from "@/core/test-generator/utils/lint-code";

const require = createRequire(import.meta.url);
const generate = require("@babel/generator").default;
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

export const generateConfigFile = async (
  filePath: string,
  configOptions: { testPattern?: string },
) => {
  const exampleFileDir = fileURLToPath(new URL("../../src", import.meta.url));
  const exampleConfigPath = join(exampleFileDir, `${CONFIG_FILENAME}.example`);

  const exampleConfigContent = await readFile(exampleConfigPath, "utf8");

  const ast = parser.parse(exampleConfigContent, {
    sourceType: "module",
    plugins: ["typescript"],
  });

  if (configOptions.testPattern) {
    const testPattern = configOptions.testPattern;
    traverse(ast, {
      ObjectProperty(path: any) {
        if (
          t.isIdentifier(path.node.key) &&
          path.node.key.name === "testPattern"
        ) {
          path.node.value = t.stringLiteral(testPattern);
        }
      },
    });
  }

  const modifiedContent = generate(ast, {
    retainLines: true,
    compact: false,
  }).code;

  const formattedCode = await formatCode(modifiedContent, process.cwd());
  const lintedCode = await lintCode(formattedCode, process.cwd());

  await writeFile(filePath, lintedCode, "utf8");
};
