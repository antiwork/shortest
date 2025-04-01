import eslintPluginReact from "eslint-plugin-react";
import eslintPluginImport from "eslint-plugin-import";
import eslintPluginPrettier from "eslint-plugin-prettier";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import typescriptEslintParser from "@typescript-eslint/parser";
import requireZodSchemaTypes from "./eslint/require-zod-schema-types.js";

export default [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".next/**",
      "packages/shortest/node_modules/**",
      "packages/shortest/dist/**",
    ],
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: typescriptEslintParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
        ecmaVersion: "latest",
        sourceType: "module",
        project: ["./tsconfig.json", "./packages/shortest/tsconfig.json"],
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslintPlugin,
      react: eslintPluginReact,
      import: eslintPluginImport,
      prettier: eslintPluginPrettier,
      "zod": {
        rules: {
          "require-zod-schema-types": requireZodSchemaTypes,
        },
      },
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/member-ordering": ["error", {
        default: {
          memberTypes: [
            "static-field",
            "static-method",

            "public-instance-field",
            "protected-instance-field",
            "private-instance-field",

            "constructor",
            "get",
            "set",

            "public-method",
            "protected-method",
            "private-method",
          ],
        },
      }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "func-style": ["error", "expression", { allowArrowFunctions: true }],
      "arrow-body-style": ["error", "as-needed"],
      "eqeqeq": ["error", "smart"],
      "no-lonely-if": "error",
      "no-lone-blocks": "error",
      "no-empty": ["error", { allowEmptyCatch: true }],
    "no-else-return": "error",
      "no-alert": "error",
      "logical-assignment-operators": "error",
      "prefer-arrow-callback": "error",
      "import/order": ["error", { alphabetize: { order: "asc" } }],
      "padding-line-between-statements": [
          "error",
          { blankLine: "always", prev: "import", next: "*" },
          { blankLine: "never", prev: "import", next: "import" },
        ],
      "prettier/prettier": [
        "error",
        {
          trailingComma: "all",
        },
      ],
      "prefer-promise-reject-errors": "error",
      "zod/require-zod-schema-types": "error",
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
];
