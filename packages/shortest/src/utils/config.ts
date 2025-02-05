import { z } from "zod";
import { configSchema, ShortestConfig } from "../types/config";
import { ConfigError } from "./errors";
import { formatZodError } from "./zod";

export const parseConfig = (config: unknown): ShortestConfig => {
  try {
    return configSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ConfigError(
        "invalid-config",
        formatZodError(error, "Invalid shortest.config"),
      );
    }
    throw error;
  }
};
