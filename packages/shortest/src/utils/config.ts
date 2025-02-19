import { z } from "zod";
import { getLogger } from "@/log/index";
import {
  configSchema,
  ShortestConfig,
  ShortestStrictConfig,
} from "@/types/config";
import { formatZodError, ConfigError } from "@/utils/errors";

/**
 * Parses and validates user configuration against the schema.
 *
 * @param {ShortestConfig} userConfig - Raw user configuration object
 * @returns {ShortestStrictConfig} - Validated configuration object
 * @throws {ConfigError} - When configuration is invalid
 *
 * @private
 */
export const parseConfig = (
  userConfig: ShortestConfig,
): ShortestStrictConfig => {
  const log = getLogger();
  try {
    const strictConfig = handleDeprecatedConfigOptions(userConfig);
    return configSchema.parse(strictConfig) as ShortestStrictConfig;
  } catch (error) {
    log.error("Error parsing config", { error });
    if (error instanceof z.ZodError) {
      throw new ConfigError(
        "invalid-config",
        formatZodError(error, "Invalid shortest.config"),
      );
    }
    throw error;
  }
};

/**
 * Handles deprecated configuration options by transforming them to their new format.
 *
 * @param {ShortestConfig} userConfig - Raw user configuration object
 * @returns {ShortestConfig} - Transformed configuration object
 * @throws {ConfigError} - When conflicting configuration options are found
 *
 * @private
 */
const handleDeprecatedConfigOptions = (
  userConfig: ShortestConfig,
): ShortestConfig => {
  const log = getLogger();
  const deprecatedAnthropicKey = userConfig.anthropicKey;

  if (deprecatedAnthropicKey) {
    if (!userConfig.ai) {
      log.warn(
        "'config.anthropicKey' option is deprecated. Use 'config.ai' structure instead.",
      );
      userConfig.ai = {
        provider: "anthropic",
        apiKey: deprecatedAnthropicKey,
      };
    } else if (userConfig.ai.provider === "anthropic") {
      if (userConfig.ai.apiKey) {
        throw new ConfigError(
          "invalid-config",
          "'config.anthropicKey' conflicts with 'config.ai.apiKey'. Please remove 'config.anthropicKey'.",
        );
      } else {
        log.warn(
          "'config.anthropicKey' option is deprecated. Please move it to 'config.ai.apiKey'.",
        );
        userConfig.ai.apiKey = deprecatedAnthropicKey;
      }
    }
    delete userConfig.anthropicKey;
  }
  return userConfig;
};
