import { FALLBACK_LLM_MODEL } from "@/ai/constants";
import { z } from "zod";

export interface ShortestConfig {
  headless: boolean;
  baseUrl: string;
  testPattern: string;
  anthropicKey?: string;
  ai: {
    provider: "anthropic";
    apiKey: string;
    model?: "claude-3-5-sonnet";
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

const aiSchema = z.object({
  provider: z.enum(["anthropic"]),
  apiKey: z.string(),
  model: z.preprocess(
    (value) => {
      if (value === undefined) {
        console.warn("Falling back to default model: claude-3-5-sonnet");
        return "claude-3-5-sonnet";
      }
      return value;
    },
    z.enum(["claude-3-5-sonnet"]),
  ),
});

export const configSchema = z.object({
  headless: z.boolean(),
  baseUrl: z.string().url("must be a valid URL"),
  testPattern: z.string(),
  ai: aiSchema,
  mailosaur: mailosaurSchema,
});
