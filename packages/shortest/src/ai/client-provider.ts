import { createAnthropic } from "@ai-sdk/anthropic";
import { LanguageModelV1 } from "ai";
import { LLM_AI_SDK_MODEL_ID_MAP } from "./constants";
import { LLMConfig, LLMSupportedModels, LLMSupportedProviders } from "@/types";

export function createAIClient(config: LLMConfig): LanguageModelV1 {
  const model = getAISDKModelId(config.provider, config.model);

  switch (config.provider) {
    case "anthropic":
      return createAnthropicClient({ model, apiKey: config.apiKey });
    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}

export function getAISDKModelId(
  provider: LLMSupportedProviders,
  model: LLMSupportedModels,
) {
  return LLM_AI_SDK_MODEL_ID_MAP[provider][model];
}

function createAnthropicClient(params: {
  model: string;
  apiKey: string;
}): LanguageModelV1 {
  const anthropic = createAnthropic({ apiKey: params.apiKey });
  return anthropic(params.model) as LanguageModelV1;
}

export function getDefaultProviderModel(
  provider: LLMSupportedProviders,
): LLMSupportedModels {
  switch (provider) {
    case LLMSupportedProviders.ANTHROPIC:
      return LLMSupportedModels.CLAUDE_3_5_SONNET;
  }
}
