import { z } from "zod";

export const llmJSONResponseSchema = z.object({
  status: z.enum(["passed", "failed"]),
  reason: z.string(),
});

export type LLMJSONResponse = z.infer<typeof llmJSONResponseSchema>;
