import { z } from "zod";

export const llmResultSchema = z.object({
  result: z.enum(["pass", "fail"]),
  reason: z.string(),
});
