import eslintPluginReact from "eslint-plugin-react";
import eslintPluginImport from "eslint-plugin-import";
import eslintPluginPrettier from "eslint-plugin-prettier";
import typescriptEslintPlugin from "@typescript-eslint/eslint-plugin";
import typescriptEslintParser from "@typescript-eslint/parser";

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
      },
    },
    plugins: {
      "@typescript-eslint": typescriptEslintPlugin,
      react: eslintPluginReact,
      import: eslintPluginImport,
      prettier: eslintPluginPrettier,
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
      "func-style": ["error", "expression", {
        "allowArrowFunctions": true
      }],
      "arrow-body-style": ["error", "as-needed"],
      "eqeqeq": ["error", "smart"],
      "no-lone-blocks": "error",
      "no-empty": ["error", { "allowEmptyCatch": true }],
      "no-else-return": "error",
      "no-alert": "error",
      "logical-assignment-operators": "error",
      "prefer-arrow-callback": "error",
      "import/order": ["error", { alphabetize: { order: "asc" } }],
      "prettier/prettier": [
        "error",
        {
          trailingComma: "all",
        },
      ],
    },
    settings: {
      react: {
        version: "detect",
      },
    },
  },
];
