import { z } from "zod";
import { formatZodError } from "@/utils/zod";
import { LLMError } from "@/utils/errors";

const JSON_REGEX = /{[\s\S]*?}/g;

/**
 * Extracts and validates the JSON payload from an LLM response string.
 *
 * @param response - The raw string output from the LLM.
 * @param schema - A Zod schema to validate and parse the JSON object.
 * @returns The validated JSON object.
 * @throws Error if no JSON is found, multiple JSON objects are found, JSON parsing fails, or validation fails.
 */
export function extractJsonPayload<T>(
  response: string,
  schema: z.ZodSchema<T>,
): T {
  const jsonMatches = response.match(JSON_REGEX);

  if (!jsonMatches || jsonMatches.length === 0) {
    throw new LLMError("invalid-response", "LLM didn't return JSON.");
  }

  if (jsonMatches.length > 1) {
    throw new LLMError(
      "invalid-response",
      "Ambiguous JSON: multiple JSON objects found.",
    );
  }

  const jsonMatch = jsonMatches[0];

  try {
    const parsedJson = JSON.parse(jsonMatch);
    return schema.parse(parsedJson);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new LLMError(
        "invalid-response",
        formatZodError(error, "Invalid LLM response."),
      );
    }
    throw error;
  }
}

export const llmJSONScreenshotReasonSchema = z.object({
  actionReason: z.enum(["journey", "verification"]),
});

export type LLMJSONScreenshotReason = z.infer<
  typeof llmJSONScreenshotReasonSchema
>;

export const llmJSONResponseSchema = z.object({
  result: z.enum(["pass", "fail"]),
  reason: z.string(),
});

export type LLMJSONResponse = z.infer<typeof llmJSONResponseSchema>;
