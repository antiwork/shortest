import { z } from "zod";

export interface ShortestConfig {
  headless: boolean;
  baseUrl: string;
  testPattern: string;
  anthropicKey?: string;
  mailosaur?: {
    apiKey?: string;
    serverId?: string;
  };
}

const mailosaurSchema = z
  .object({
    apiKey: z.string(),
    serverId: z.string(),
  })
  .optional();

export const configSchema = z
  .object({
    headless: z.boolean(),
    baseUrl: z
      .string()
      .url("baseUrl must be a valid URL (e.g. https://example.com)"),
    testPattern: z.string(),
    anthropicKey: z.string().optional(),
    mailosaur: mailosaurSchema,
  })
  .refine((config) => config.anthropicKey || process.env.ANTHROPIC_API_KEY, {
    message:
      "anthropicKey must be provided in config or ANTHROPIC_API_KEY environment variable",
  });

export const validateConfig = (config: unknown): ShortestConfig => {
  return configSchema.parse(config);
};
