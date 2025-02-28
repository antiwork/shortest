import { z } from "zod";
import type { TestContext } from "@/types/test";

const TestCaseFunctionSchema = z
  .function()
  .args(z.custom<TestContext>())
  .returns(z.promise(z.void()));

const TestCaseExpectationsSchema = z.object({
  description: z.string().optional(),
  payload: z.any().optional(),
  fn: TestCaseFunctionSchema.optional(),
  directExecution: z.boolean().optional().default(false),
});

const TestCaseSchema = z.object({
  name: z.string(),
  filePath: z.string(),
  payload: z.any().optional(),
  fn: TestCaseFunctionSchema.optional(),
  expectations: z.array(TestCaseExpectationsSchema).default([]),
  beforeFn: TestCaseFunctionSchema.optional(),
  afterFn: TestCaseFunctionSchema.optional(),
  directExecution: z.boolean().optional().default(false),
});
export type TestCase = z.infer<typeof TestCaseSchema>;

export const createTestCase = (props: unknown): TestCase => ({
  ...TestCaseSchema.parse(props),
});
