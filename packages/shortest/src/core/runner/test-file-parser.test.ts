import path from "path";
import { fileURLToPath } from "url";
import { describe, test, expect } from "vitest";
import {
  parseShortestTestFile,
  EXPRESSION_PLACEHOLDER,
} from "./test-file-parser.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixturesPath = path.resolve(__dirname, "../../../tests/fixtures");

describe("test-file-parser", () => {
  describe("parseShortestTestFile", () => {
    test("correctly parses test locations from a file", () => {
      const sampleTestPath = path.join(fixturesPath, "sample-test.ts");
      const testLocations = parseShortestTestFile(sampleTestPath);

      expect(testLocations).toHaveLength(4);

      expect(testLocations[0]).toEqual({
        testName:
          "Visit github.com and verify the global navigation header layout. Check GitHub logo, search bar, navigation items (Pull requests, Issues, Marketplace, Explore), and profile dropdown maintain correct spacing and alignment",
        startLine: 3,
        endLine: 14,
      });

      expect(testLocations[1]).toEqual({
        testName: `Test Google's advanced search features`,
        startLine: 16,
        endLine: 37,
      });

      expect(testLocations[2]).toEqual({
        testName: `Test the API POST endpoint ${EXPRESSION_PLACEHOLDER}/assert-bearer with body { "flagged": "false" } without providing a bearer token.`,
        startLine: 42,
        endLine: 44,
      });

      expect(testLocations[3]).toEqual({
        testName: `Test the API POST endpoint ${EXPRESSION_PLACEHOLDER}/assert-bearer with body { "flagged": "true" } and the bearer token ${EXPRESSION_PLACEHOLDER}. Expect the response to show "flagged": true`,
        startLine: 46,
        endLine: 49,
      });
    });

    test("returns empty array for files with no tests", () => {
      const emptyTestPath = path.join(fixturesPath, "empty-test.ts");

      const testLocations = parseShortestTestFile(emptyTestPath);

      expect(testLocations).toEqual([]);
    });
  });
});
