import { z } from "zod";
import { AIError } from "@/utils/errors";
import { formatZodError } from "@/utils/zod";

const JSON_REGEX = /{[\s\S]*?}/g;

/**
 * Extracts and validates the JSON payload from an AI response string.
 *
 * @param response - The raw string output from the AI.
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
    throw new AIError("invalid-response", "AI didn't return JSON.");
  }

  if (jsonMatches.length > 1) {
    throw new AIError(
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
      throw new AIError(
        "invalid-response",
        formatZodError(error, "Invalid AI response."),
      );
    }
    throw error;
  }
}

export const aiJSONResponseSchema = z.object({
  status: z.enum(["passed", "failed"]),
  reason: z.string(),
});

export type AIJSONResponse = z.infer<typeof aiJSONResponseSchema>;
