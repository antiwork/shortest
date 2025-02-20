import { readFile, writeFile } from "node:fs/promises";
import os from "os";
import { join } from "path";
import { ENV_LOCAL_FILENAME } from "@/constants";

// eslint-disable-next-line zod/require-zod-schema-types
type EnvResult = {
  added: string[];
  skipped: string[];
  wasCreated: boolean;
  error?: Error;
};

export const addToEnv = async (
  path: string,
  entries: Record<string, { value: string; comment?: string }>,
): Promise<EnvResult> => {
  const result: EnvResult = {
    added: [],
    skipped: [],
    wasCreated: false,
  };

  try {
    const envPath = join(path, ENV_LOCAL_FILENAME);
    let envContent = await readFile(envPath, "utf8").catch(() => null);
    result.wasCreated = envContent === null;
    envContent ??= "";
    const EOL = envContent.includes("\r\n") ? "\r\n" : os.EOL;

    const existingEntries = new Map(
      envContent
        .split(EOL)
        .filter((line) => line.trim() && !line.startsWith("#"))
        .map((line) => {
          const [key] = line.split("=");
          return [key.trim(), true];
        }),
    );

    let content = envContent;
    for (const [key, { value, comment }] of Object.entries(entries)) {
      if (existingEntries.has(key)) {
        result.skipped.push(key);
        continue;
      }

      const needsEol = content.length > 0 && !content.endsWith(EOL);
      if (comment) {
        content += `${needsEol ? EOL : ""}# ${comment}${EOL}`;
      }
      content += `${needsEol && !comment ? EOL : ""}${key}=${value}${EOL}`;
      result.added.push(key);
    }

    if (result.added.length > 0) {
      await writeFile(envPath, content);
    }
  } catch (error) {
    result.error = error as Error;
  }

  return result;
};
