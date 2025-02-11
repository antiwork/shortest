/**
 * @fileoverview ESLint plugin that warns against using the native 'console' for logging,
 * and recommends using 'Log' instead.
 *
 */

const plugin = {
  rules: {
    main: {
      meta: {
        docs: {
          description:
            "Disallow the use of 'console'. Use 'Log' instead for logging.",
          recommended: true,
        },
        messages: {
          noConsole: "Do not use 'console'. Instead, use 'Log' for logging.",
        },
      },
      create(context) {
        return {
          MemberExpression(node) {
            if (
              node.object &&
              node.object.type === "Identifier" &&
              node.object.name === "console"
            ) {
              context.report({
                node,
                messageId: "noConsole",
              });
            }
          },
        };
      },
    },
  },
  configs: {},
};

Object.assign(plugin.configs, {
  recommended: [
    {
      plugins: {
        "no-console-usage": plugin,
      },
      rules: {
        "no-console-usage/main": "warn",
      },
      languageOptions: {
        globals: {
          myGlobal: "readonly",
        },
        parserOptions: {
          ecmaFeatures: {
            jsx: true,
          },
        },
      },
    },
  ],
});

export default plugin;
