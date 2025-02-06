import { LLMSupportedModels, LLMSupportedProviders } from "@/types";

export const LLM_AI_SDK_MODEL_ID_MAP: Record<
  LLMSupportedProviders,
  Record<LLMSupportedModels, string>
> = {
  [LLMSupportedProviders.ANTHROPIC]: {
    [LLMSupportedModels.CLAUDE_3_5_SONNET]: "claude-3-5-sonnet-20241022",
  },
};
