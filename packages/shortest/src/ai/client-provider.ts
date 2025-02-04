import assert from "node:assert";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createAmazonBedrock } from "@ai-sdk/amazon-bedrock";
import { LanguageModelV1 } from "ai";
import { LLMConfig } from "../types/ai";

/**
 * Creates an AI client based on the provided configuration.
 *
 * @param config - The configuration for the language model.
 * @returns A LanguageModelV1 instance.
 * @throws Will throw an error if the provider or model is unsupported or if required environment variables are missing.
 */
export function createAIClient(config: LLMConfig): LanguageModelV1 {
  const { provider, region, accessKeyId, secretAccessKey } = config;
  const model = resolveWhitelistedProviderModel(provider, config.model);

  switch (provider) {
    case "anthropic":
      return createAnthropicClient(model);

    case "amazon-bedrock":
      return createAmazonBedrockClient({
        region,
        accessKeyId,
        secretAccessKey,
        model,
      });

    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Resolves and creates the Anthropic client.
 *
 * @param model - The provider-specific model string.
 * @returns A LanguageModelV1 instance for Anthropic.
 * @throws Will throw an error if the API key is missing.
 */
function createAnthropicClient(model: string): LanguageModelV1 {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  assert(
    apiKey,
    "Missing Anthropic API key. Please set process.env.ANTHROPIC_API_KEY.",
  );

  const anthropic = createAnthropic({ apiKey });
  return anthropic(model) as LanguageModelV1;
}

/**
 * Resolves environment variables for Amazon Bedrock and creates its client.
 *
 * @param params - An object containing configuration parameters.
 * @returns A LanguageModelV1 instance for Amazon Bedrock.
 * @throws Will throw an error if any required credentials are missing.
 */
function createAmazonBedrockClient(params: {
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  model: string;
}): LanguageModelV1 {
  const region =
    params.region || process.env.SHORTEST_AWS_REGION || process.env.AWS_REGION;
  const accessKeyId =
    params.accessKeyId ||
    process.env.SHORTEST_AWS_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey =
    params.secretAccessKey ||
    process.env.SHORTEST_AWS_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY;

  assert(
    region,
    "Missing AWS region. Please set a region in the configuration or as an environment variable.",
  );
  assert(
    accessKeyId,
    "Missing AWS access key id. Please set accessKeyId in the configuration or as an environment variable.",
  );
  assert(
    secretAccessKey,
    "Missing AWS secret access key. Please set secretAccessKey in the configuration or as an environment variable.",
  );

  const bedrock = createAmazonBedrock({
    region,
    accessKeyId,
    secretAccessKey,
  });
  return bedrock(params.model) as LanguageModelV1;
}

const FALLBACK_MODEL = "claude-3-5-sonnet";
/**
 * Whitelisted models for each AI provider. The keys are the internal model names
 * and the values are the provider-specific model strings.
 */
const MODEL_WHITELIST: {
  [provider in LLMConfig["provider"]]: Record<string, string>;
} = {
  anthropic: {
    "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
  },
  "amazon-bedrock": {
    "claude-3-5-sonnet": "anthropic.claude-3-5-sonnet-20241022-v2:0",
  },
};

/**
 * Maps high-level model name to the appropriate provider-specific whitelisted model string.
 * If the provided model is not found in the whitelist, it falls back to "claude-3-5-sonnet".
 *
 * @param model - The internal model name.
 * @param provider - The AI provider.
 * @returns The provider-specific model string.
 */
export function resolveWhitelistedProviderModel(
  provider: LLMConfig["provider"],
  model?: LLMConfig["model"],
): string {
  const whitelist = MODEL_WHITELIST[provider];
  if (!whitelist) {
    throw new Error(`No model whitelist defined for provider: ${provider}`);
  }

  if (!model) {
    const allowedModels = Object.keys(whitelist).join(", ");
    console.warn(
      `You don't have model specified in your Shortest config. Falling back to '${FALLBACK_MODEL}'. Allowed models are: ${allowedModels}`,
    );
    return whitelist[FALLBACK_MODEL];
  }

  return whitelist[model];
}
