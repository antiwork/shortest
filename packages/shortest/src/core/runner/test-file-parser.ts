import { readFileSync } from "fs";
import { createRequire } from "module";
import * as parser from "@babel/parser";
import type { NodePath } from "@babel/traverse";
import type * as t from "@babel/types";
import * as babelTypes from "@babel/types";
import { z } from "zod";
import { SHORTEST_NAME } from "@/cli/commands/shortest";
import { getLogger } from "@/log";

const require = createRequire(import.meta.url);
const traverse = require("@babel/traverse").default;

export const EXPRESSION_PLACEHOLDER = "${...}";

export const TestLocationSchema = z.object({
  testName: z.string(),
  startLine: z.number().int().positive(),
  endLine: z.number().int().positive(),
});
export type TestLocation = z.infer<typeof TestLocationSchema>;

const TestLocationsSchema = z.array(TestLocationSchema);

export const parseShortestTestFile = (filePath: string): TestLocation[] => {
  const log = getLogger();
  try {
    log.setGroup("File Parser");

    const TemplateElementSchema = z.object({
      value: z.object({
        cooked: z.string().optional(),
        raw: z.string().optional(),
      }),
    });
    type TemplateElement = z.infer<typeof TemplateElementSchema>;

    const StringLiteralSchema = z.object({
      type: z.literal("StringLiteral"),
      value: z.string(),
    });

    const TemplateLiteralSchema = z.object({
      type: z.literal("TemplateLiteral"),
      quasis: z.array(TemplateElementSchema),
    });

    const fileContent = readFileSync(filePath, "utf8");
    const ast = parser.parse(fileContent, {
      sourceType: "module",
      plugins: [
        "typescript",
        "objectRestSpread",
        "optionalChaining",
        "nullishCoalescingOperator",
      ],
    });

    const testLocations: TestLocation[] = [];

    const testCallsByLine = new Map<
      number,
      { name: string; node: NodePath<t.CallExpression> }
    >();

    traverse(ast, {
      CallExpression(path: NodePath<t.CallExpression>) {
        const node = path.node;

        if (
          !node.type ||
          node.type !== "CallExpression" ||
          !node.callee ||
          node.callee.type !== "Identifier" ||
          node.callee.name !== SHORTEST_NAME
        ) {
          return;
        }

        const args = node.arguments || [];
        if (args.length === 0) return;

        const firstArg = args[0];
        let testName = "";

        if (babelTypes.isStringLiteral(firstArg)) {
          const parsed = StringLiteralSchema.parse(firstArg);
          testName = parsed.value;
        } else if (babelTypes.isTemplateLiteral(firstArg)) {
          const parsed = TemplateLiteralSchema.parse(firstArg);
          testName = parsed.quasis
            .map(
              (quasi: TemplateElement, i: number, arr: TemplateElement[]) => {
                const str = quasi.value.cooked || quasi.value.raw || "";
                return i < arr.length - 1 ? str + EXPRESSION_PLACEHOLDER : str;
              },
            )
            .join("")
            .replace(/\s+/g, " ")
            .trim();
        } else {
          return;
        }

        const startLine = node.loc?.start?.line || 0;
        testCallsByLine.set(startLine, {
          name: testName,
          node: path,
        });
      },
    });

    const sortedStartLines = Array.from(testCallsByLine.keys()).sort(
      (a, b) => a - b,
    );

    for (let i = 0; i < sortedStartLines.length; i++) {
      const currentLine = sortedStartLines[i];
      const nextLine = sortedStartLines[i + 1] || Number.MAX_SAFE_INTEGER;
      const { name, node } = testCallsByLine.get(currentLine)!;

      const path = node;
      let endLine = path.node.loc?.end?.line || 0;

      let currentPath: NodePath<t.Node> = path;
      while (
        currentPath.parentPath &&
        (currentPath.parentPath.node.loc?.end?.line ?? 0) < nextLine
      ) {
        const parentType = currentPath.parentPath.node.type;

        if (parentType === "ExpressionStatement") {
          endLine = currentPath.parentPath.node.loc?.end?.line || endLine;
          break;
        }

        if (
          parentType === "CallExpression" ||
          parentType === "MemberExpression"
        ) {
          currentPath = currentPath.parentPath;
          endLine = Math.max(endLine, currentPath.node.loc?.end?.line || 0);
        } else {
          endLine = Math.max(
            endLine,
            currentPath.parentPath.node.loc?.end?.line || endLine,
          );
          break;
        }
      }
      endLine = Math.min(endLine, nextLine - 1);

      const testLocation = TestLocationSchema.parse({
        testName: name,
        startLine: currentLine,
        endLine,
      });
      testLocations.push(testLocation);
    }

    log.trace("Test locations", { filePath, testLocations });

    return TestLocationsSchema.parse(testLocations);
  } finally {
    log.resetGroup();
  }
};
