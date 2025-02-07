/**
 * @fileoverview ESLint plugin to warn against the usage of console and recommend using Logger from @shortest/logger.
 */

const plugin = {
  meta: {
    name: "eslint-plugin-no-console-usage",
    type: "problem",
    docs: {
      description:
        "Warns against the direct usage of console and recommends using a logger obtained from getLogger()",
      category: "Best Practices",
    },
  },
  configs: {},
  rules: {
    main: {
      meta: {
        fixable: "code",
        messages: {
          noConsole:
            "Do not use 'console'. Instead, call getLogger() to obtain a logger instance for logging.",
        },
      },
      create(context) {
        return {
          MemberExpression(node) {
            if (node.object.name === "console") {
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
