/** @type {import('eslint').Rule.RuleModule} */
export default {
  meta: {
    type: "problem",
    docs: {
      description: "Require type aliases to be derived from Zod schemas for runtime type validation. React component types and Drizzle ORM types are exempt. @see https://zod.dev",
    },
    schema: [],
    messages: {
      useInfer: "Type aliases must use z.infer<typeof Schema> for runtime validation. Example:\n" +
        "const MySchema = z.object({ field: z.string() });\n" +
        "type MyType = z.infer<typeof MySchema>;\n\n" +
        "See https://zod.dev for more examples."
    },
  },
  create(context) {
    const zodIdentifiers = new Set();

    /**
     * Set ZOD_SCHEMA_TYPES_DEBUG=true in environment to debug all type patterns.
     * Example: ZOD_SCHEMA_TYPES_DEBUG=true npx eslint .
     *
     * Useful when adding support for new type structures.
     * @example
     * // Example output:
     * // /path/to/file.ts:42:10
     * // Type: User
     * // Structure: {
     * //   "nodeType": "TSTypeQuery",
     * //   "expression": {
     * //     "type": "TSQualifiedName",
     * //     "table": "users",
     * //     "method": "$inferSelect"
     * //   }
     * // }
     */
    const DEBUG_TYPES = process.env.ZOD_SCHEMA_TYPES_DEBUG === "true";

    /** Debug helper for analyzing type patterns */
    const debugTypePattern = (node, name = "") => {
      if (!DEBUG_TYPES) return;

      const filename = context.filename;
      const location = node.loc?.start;
      const locationStr = location ? `${filename}:${location.line}:${location.column}` : filename;

      const structure = {
        nodeType: node.type,
        ...(node.type === "TSTypeQuery" && {
          expression: {
            type: node.exprName?.type,
            table: node.exprName?.left?.name,
            method: node.exprName?.right?.name
          }
        }),
        ...(node.type === "TSTypeReference" && {
          typeName: {
            type: node.typeName?.type,
            namespace: node.typeName?.left?.name,
            method: node.typeName?.right?.name
          }
        })
      };

      console.log(
        `\n${locationStr}\n` +
        `Type: ${name}\n` +
        `Structure: ${JSON.stringify(structure, null, 2)}`
      );
    };

    /** @param {import('@typescript-eslint/types').TSESTree.ImportClause} specifier */
    const isZodImport = (specifier) => {
      if (specifier.type !== "ImportSpecifier") return false;
      return (
        specifier.imported.type === "Identifier" &&
        specifier.imported.name === "z"
      );
    };

    /** @param {import('@typescript-eslint/types').TSESTree.TypeNode} typeAnnotation */
    const isReactType = (typeAnnotation) => {
      if (
        !typeAnnotation?.typeName ||
        typeAnnotation.typeName.type !== "TSQualifiedName"
      ) {
        return false;
      }

      const { left } = typeAnnotation.typeName;
      return left.type === "Identifier" && left.name === "React";
    };

    /** @param {import('@typescript-eslint/types').TSESTree.TypeNode} typeAnnotation */
    const isDrizzleInferType = (typeAnnotation) => {
      if (typeAnnotation?.type !== "TSTypeQuery") return false;

      const { exprName } = typeAnnotation;
      if (!exprName || exprName.type !== "TSQualifiedName") return false;

      const { right } = exprName;
      return (
        right?.type === "Identifier" &&
        (right.name === "$inferSelect" || right.name === "$inferInsert")
      );
    };

    /** @param {import('@typescript-eslint/types').TSESTree.TSQualifiedName} typeName */
    const isZodReference = (typeName) => {
      const { left } = typeName;

      if (left.type === "Identifier") {
        return zodIdentifiers.has(left.name);
      }

      if (
        left.type === "TSQualifiedName" &&
        left.left.type === "Identifier"
      ) {
        return zodIdentifiers.has(left.left.name);
      }

      return false;
    };

    /** @param {import('@typescript-eslint/types').TSESTree.TypeNode} typeAnnotation */
    const isZodInferType = (typeAnnotation) => {
      if (
        !typeAnnotation?.typeName ||
        typeAnnotation.typeName.type !== "TSQualifiedName"
      ) {
        return false;
      }

      const { right } = typeAnnotation.typeName;
      return (
        isZodReference(typeAnnotation.typeName) &&
        right.type === "Identifier" &&
        right.name === "infer"
      );
    };

    return {
      ImportDeclaration(node) {
        if (node.source.value === "zod") {
          node.specifiers
            .filter(isZodImport)
            .forEach((spec) => zodIdentifiers.add(spec.local.name));
        }
      },

      TSTypeAliasDeclaration(node) {
        debugTypePattern(node.typeAnnotation, node.id.name);

        if (
          isReactType(node.typeAnnotation) ||
          isDrizzleInferType(node.typeAnnotation) ||
          isZodInferType(node.typeAnnotation)
        ) {
          return;
        }

        context.report({
          node,
          messageId: "useInfer",
        });
      },
    };
  },
};
