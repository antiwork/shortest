import { z } from "zod";

export interface ShortestConfig {
  headless: boolean;
  baseUrl: string;
  testPattern: string;
  ai?: {
    provider?: string;
    apiKey?: string;
    model?: string;
  };
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

const aiSchema = z
  .object({
    provider: z.string().optional(),
    apiKey: z.string().optional(),
    model: z.string().optional(),
  })
  .optional();

export const configSchema = z
  .object({
    headless: z.boolean(),
    baseUrl: z.string().url("must be a valid URL"),
    testPattern: z.string(),
    mailosaur: mailosaurSchema,
    ai: aiSchema,
  })
  .refine(
    (config) => {
      if (config.ai?.provider === "anthropic") {
        return config.ai.apiKey || 
               process.env.SHORTEST_ANTHROPIC_API_KEY || 
               process.env.ANTHROPIC_API_KEY;
      }
      return true;
    },
    {
      message: "For provider 'anthropic', an API key must be provided in config or via environment variables.",
    }
  );
