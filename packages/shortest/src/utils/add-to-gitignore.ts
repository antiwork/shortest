import { readFile, writeFile } from "node:fs/promises";
import os from "os";
import { join } from "path";

// eslint-disable-next-line zod/require-zod-schema-types
type GitIgnoreResult = {
  wasCreated: boolean;
  wasUpdated: boolean;
  error?: Error;
};

export const addToGitignore = async (
  path: string,
  values: string[],
): Promise<GitIgnoreResult> => {
  const result: GitIgnoreResult = {
    wasCreated: false,
    wasUpdated: false,
  };

  try {
    const gitignorePath = join(path, ".gitignore");
    let gitignore = await readFile(gitignorePath, "utf8").catch(() => null);
    const isNewFile = gitignore === null;
    gitignore ??= "";
    const EOL = gitignore.includes("\r\n") ? "\r\n" : os.EOL;

    const addValue = (content: string, value: string): string => {
      if (!content.split(EOL).includes(value)) {
        return `${content}${
          content.endsWith(EOL) || content.length === 0 ? "" : EOL
        }${value}${EOL}`;
      }
      return content;
    };

    let modified = false;
    let content = gitignore;
    for (const value of values) {
      const newContent = addValue(content, value);
      if (newContent !== content) {
        modified = true;
        content = newContent;
      }
    }

    if (modified) {
      await writeFile(gitignorePath, content);
      result.wasCreated = isNewFile;
      result.wasUpdated = !isNewFile;
    }
  } catch (error) {
    result.error = error as Error;
  }

  return result;
};
