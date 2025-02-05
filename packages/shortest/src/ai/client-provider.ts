import { createAnthropic } from "@ai-sdk/anthropic";
import { LanguageModelV1 } from "ai";
import { LLMConfig } from "../types/ai";

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
};

/**
 * Creates an AI client based on the provided configuration.
 */
export function createAIClient(config: LLMConfig): LanguageModelV1 {
  const model = MODEL_WHITELIST[config.provider][config.model as string];

  switch (config.provider) {
    case "anthropic":
      return createAnthropicClient({ model, apiKey: config.apiKey });
  }
}

/**
 * Creates an Anthropic language model client.
 */
function createAnthropicClient(params: {
  model: string;
  apiKey: string;
}): LanguageModelV1 {
  const anthropic = createAnthropic({ apiKey: params.apiKey });
  return anthropic(params.model) as LanguageModelV1;
}
