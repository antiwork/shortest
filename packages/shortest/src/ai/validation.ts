import { z } from "zod";

export const llmJSONResponseSchema = z.object({
  result: z.enum(["pass", "fail"]),
  reason: z.string(),
});

export type LLMJSONResponse = z.infer<typeof llmJSONResponseSchema>;
