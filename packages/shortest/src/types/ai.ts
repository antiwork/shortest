// import { LanguageModelUsage } from "ai";
import { z } from "zod";

// TODO: Validate against LanguageModelUsage
export const TokenUsageSchema = z.object({
  completionTokens: z.number().default(0),
  promptTokens: z.number().default(0),
  totalTokens: z.number().default(0),
});
export type TokenUsage = z.infer<typeof TokenUsageSchema>;
