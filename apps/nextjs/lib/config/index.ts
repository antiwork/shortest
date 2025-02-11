import { promises as fs } from "fs";
import yaml from "js-yaml";
import {
  ConfigSchema,
  Config,
  RepositoryConfig,
  DEFAULT_REPO_CONFIG,
} from "./schema";

const CONFIG_FILE_PATH = "shortest.yml";

let config: Readonly<Config> = Object.freeze({});

async function loadConfig(): Promise<void> {
  try {
    const fileContents = await fs.readFile(CONFIG_FILE_PATH, "utf8");
    const parsedConfig = yaml.load(fileContents) as Record<string, unknown>;

    config = Object.freeze(
      parsedConfig && Object.keys(parsedConfig).length > 0
        ? ConfigSchema.parse(parsedConfig)
        : {},
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      config = Object.freeze({});
    } else {
      throw new Error(
        `Failed to load configuration: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }
}

async function getConfig(): Promise<Readonly<Config>> {
  if (Object.keys(config).length === 0) {
    await loadConfig();
  }
  return config;
}

async function getRepoConfig({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}): Promise<RepositoryConfig> {
  const fullConfig = await getConfig();
  const repoKey = `${owner}/${repo}`;
  return (
    fullConfig[repoKey] || { repository_name: repoKey, ...DEFAULT_REPO_CONFIG }
  );
}

async function getTestPatternsConfig({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}): Promise<RepositoryConfig["test_patterns"]> {
  const repoConfig = await getRepoConfig({ owner, repo });
  return repoConfig.test_patterns;
}

export { getConfig, getRepoConfig, getTestPatternsConfig };

// Add this export for testing
export function _resetConfigForTesting(): void {
  config = Object.freeze({});
}
