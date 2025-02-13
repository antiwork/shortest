import { z } from "zod";

const mailosaurSchema = z
  .object({
    apiKey: z.string(),
    serverId: z.string(),
  })
  .optional();

const ANTHROPIC_MODELS = ["claude-3-5-sonnet-20241022"] as const;

const aiSchema = z
  .object({
    provider: z.literal("anthropic"),
    apiKey: z.string().default(() => process.env.ANTHROPIC_API_KEY!),
    model: z.enum(ANTHROPIC_MODELS).default(ANTHROPIC_MODELS[0]),
  })
  .strict();
export type AIConfig = z.infer<typeof aiSchema>;

export const configSchema = z
  .object({
    headless: z.boolean().default(true),
    baseUrl: z.string().url("must be a valid URL"),
    testPattern: z.string(),
    anthropicKey: z.string().optional(),
    ai: aiSchema,
    mailosaur: mailosaurSchema.optional(),
  })
  .strict();

export const userConfigSchema = configSchema.extend({
  ai: aiSchema.strict().partial().optional(),
});

export type ShortestConfig = z.infer<typeof userConfigSchema>;
export type ShortestStrictConfig = z.infer<typeof configSchema>;
