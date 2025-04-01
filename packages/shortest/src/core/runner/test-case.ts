import { z } from "zod";
import type { TestContext } from "@/types/test";
import { createHash } from "@/utils/create-hash";
import { formatZodError, ShortestError } from "@/utils/errors";

/**
 * Schema for test case functions that receive a TestContext and return a Promise<void>
 */
const TestCaseFunctionSchema = z
  .function()
  .args(z.custom<TestContext>())
  .returns(z.promise(z.void()));

/**
 * Schema for test case expectations that define test behavior and validation
 *
 * @property {string} [description] - Optional description of the expectation
 * @property {any} [payload] - Optional data payload for the expectation
 * @property {Function} [fn] - Optional function to execute for this expectation
 * @property {boolean} [directExecution] - Whether to execute this expectation directly (defaults to false)
 */
const TestCaseExpectationsSchema = z.object({
  description: z.string().optional(),
  payload: z.any().optional(),
  fn: TestCaseFunctionSchema.optional(),
  directExecution: z.boolean().optional().default(false),
});

/**
 * Schema and type definition for test cases in the testing framework
 *
 * @property {string} name - The name of the test case
 * @property {string} filePath - Path to the file containing this test case
 * @property {any} [payload] - Optional data payload for the test
 * @property {Function} [fn] - Optional main test function
 * @property {Array<Expectation>} [expectations] - Array of validation expectations
 * @property {Function} [beforeFn] - Optional setup function to run before the test
 * @property {Function} [afterFn] - Optional cleanup function to run after the test
 * @property {boolean} [directExecution] - Whether to execute test directly (defaults to false)
 * @property {string} identifier - Unique identifier for the test case (auto-generated)
 *
 */
const TestCaseSchema = z
  .object({
    name: z.string(),
    filePath: z.string(),
    payload: z.any().optional(),
    fn: TestCaseFunctionSchema.optional(),
    expectations: z.array(TestCaseExpectationsSchema).default([]),
    beforeFn: TestCaseFunctionSchema.optional(),
    afterFn: TestCaseFunctionSchema.optional(),
    directExecution: z.boolean().optional().default(false),
    identifier: z.string().optional(),
  })
  .strict()
  .transform((data) => {
    const hashInput = `${data.name}:${data.filePath}:${JSON.stringify(data.expectations)}`;

    return {
      ...data,
      // Low collision risk for datasets under 65,000 tests
      identifier: createHash(hashInput, { length: 8 }),
    };
  });
export type TestCase = z.infer<typeof TestCaseSchema>;

/**
 * Creates a validated TestCase instance from the provided properties
 *
 * @param {unknown} props - Raw properties to create the test case from
 * @returns {TestCase} A validated TestCase instance
 * @throws {ShortestError} When validation fails with formatted error details
 *
 * @example
 * ```typescript
 * const testCase = createTestCase({
 *   name: "My test",
 *   filePath: "/tests/my-test.ts",
 *   fn: async (ctx) => { await ctx.page.goto("https://example.com"); }
 * });
 * ```
 */
export const createTestCase = (props: unknown): TestCase => {
  try {
    return {
      ...TestCaseSchema.parse(props),
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ShortestError(formatZodError(error, "Invalid TestCase format"));
    }
    throw error;
  }
};
