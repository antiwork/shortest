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

/**
 * Loads configuration file.
 *
 * @throws {Error} When configuration file cannot be parsed
 *
 * @private
 */
const loadConfig = async (): Promise<void> => {
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
};

/**
 * Returns the current configuration, loading it if necessary.
 *
 * @returns {Promise<Readonly<Config>>} Frozen configuration object
 * @throws {Error} When configuration cannot be loaded
 *
 * @private
 */
export const getConfig = async (): Promise<Readonly<Config>> => {
  if (Object.keys(config).length === 0) {
    await loadConfig();
  }
  return config;
};

/**
 * Gets repository-specific configuration.
 *
 * @param {Object} params - Repository parameters
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @returns {Promise<RepositoryConfig>} Repository configuration
 *
 * @private
 */
export const getRepoConfig = async ({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}): Promise<RepositoryConfig> => {
  const fullConfig = await getConfig();
  const repoKey = `${owner}/${repo}`;
  return (
    fullConfig[repoKey] || { repository_name: repoKey, ...DEFAULT_REPO_CONFIG }
  );
};

/**
 * Gets test patterns configuration for a repository.
 *
 * @param {Object} params - Repository parameters
 * @param {string} params.owner - Repository owner
 * @param {string} params.repo - Repository name
 * @returns {Promise<RepositoryConfig["test_patterns"]>} Test patterns configuration
 *
 * @private
 */
export const getTestPatternsConfig = async ({
  owner,
  repo,
}: {
  owner: string;
  repo: string;
}): Promise<RepositoryConfig["test_patterns"]> => {
  const repoConfig = await getRepoConfig({ owner, repo });
  return repoConfig.test_patterns;
};
