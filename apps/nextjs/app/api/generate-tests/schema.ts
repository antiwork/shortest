import { z } from "zod";

export const generateTestsSchema = z.object({
  mode: z.enum(["write", "update"]),
  pr_id: z.number(),
  pr_diff: z.string(),
  test_files: z.array(
    z.object({
      name: z.string(),
      content: z.string(),
    }),
  ),
});

export const generateTestsResponseSchema = z.array(
  z.object({
    name: z.string(),
    content: z.string(),
  }),
);

export const TestFileSchema = z.object({
  tests: z.array(
    z.object({
      name: z.string(),
      content: z.string(),
    }),
  ),
});

export const GenerateTestsInput = z.object({
  mode: z.enum(["write", "update"]),
  pr_id: z.number(),
  pr_diff: z.string(),
  test_files: z.array(
    z.object({
      name: z.string(),
      content: z.string(),
    }),
  ),
  test_logs: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        logs: z.array(z.string()),
      }),
    )
    .optional(),
});

export type GenerateTestsInput = z.infer<typeof GenerateTestsInput>;
export type GenerateTestsResponse = z.infer<typeof generateTestsResponseSchema>;
