import { describe, test, expect, beforeEach, vi } from "vitest";
import { getLogger } from "@/log/index";
import { ShortestConfig } from "@/types";
import { parseConfig } from "@/utils/config";

describe("Config parsing", () => {
  let baseConfig: ShortestConfig;

  describe("with minimal config", () => {
    const minimalConfig = {
      baseUrl: "https://example.com",
      ai: {
        provider: "anthropic",
        apiKey: "foo",
      },
    } as ShortestConfig;

    test("it generates default config", () => {
      const config = parseConfig(minimalConfig);
      expect(Object.keys(config)).toEqual([
        "headless",
        "baseUrl",
        "browser",
        "testPattern",
        "ai",
        "caching",
      ]);
      expect(config.headless).toBe(true);
      expect(config.baseUrl).toBe("https://example.com");
      expect(config.browser).toEqual({});
      expect(config.testPattern).toBe("**/*.test.ts");
      expect(config.ai).toEqual({
        apiKey: "foo",
        model: "claude-3-5-sonnet-20241022",
        provider: "anthropic",
      });
      expect(config.caching).toEqual({
        enabled: true,
      });
    });
  });

  beforeEach(() => {
    baseConfig = {
      headless: true,
      baseUrl: "https://example.com",
      testPattern: ".*",
      ai: {
        provider: "anthropic",
        apiKey: "explicit-api-key",
      },
    };
  });

  describe("with invalid config.browser option", () => {
    test("it throws an error", () => {
      const userConfig = {
        ...baseConfig,
        browser: {
          invalidBrowserOption: "value",
        },
      } as any;
      expect(() => parseConfig(userConfig)).toThrowError(
        "Unrecognized key(s) in object: 'invalidBrowserOption'",
      );
    });
  });

  describe("with config.browser.contextOptions option", () => {
    test("it passes through", () => {
      const userConfig = {
        ...baseConfig,
        browser: {
          contextOptions: { ignoreHTTPSErrors: true },
        },
      };
      const config = parseConfig(userConfig);
      expect(config.browser?.contextOptions).toEqual({
        ignoreHTTPSErrors: true,
      });
    });
  });

  describe("with invalid config option", () => {
    test("it throws an error", () => {
      const userConfig = {
        ...baseConfig,
        invalidOption: "value",
      };
      expect(() => parseConfig(userConfig)).toThrowError(
        "Unrecognized key(s) in object: 'invalidOption'",
      );
    });
  });

  describe("with invalid config.ai option", () => {
    test("it throws an error", () => {
      const userConfig = {
        ...baseConfig,
        ai: {
          ...baseConfig.ai,
          invalidAIOption: "value",
        },
      };
      expect(() => parseConfig(userConfig)).toThrowError(
        "Unrecognized key(s) in object: 'invalidAIOption'",
      );
    });
  });

  describe("with config.ai", () => {
    describe("without ANTHROPIC_API_KEY", () => {
      test("it throws an error", () => {
        const userConfig = {
          ...baseConfig,
          ai: {
            ...baseConfig.ai,
            apiKey: undefined,
          },
        };
        expect(() => parseConfig(userConfig)).toThrowError(
          /Invalid shortest\.config\n(?:\u001b\[\d+m)?ai\.apiKey(?:\u001b\[\d+m)?: Required \(received: "undefined"\)/,
        );
      });
    });

    describe("with ANTHROPIC_API_KEY", () => {
      beforeEach(() => {
        process.env.ANTHROPIC_API_KEY = "env-api-key";
      });

      describe("without ai.apiKey", () => {
        test("uses value from ANTHROPIC_API_KEY", () => {
          const userConfig = {
            ...baseConfig,
            ai: {
              ...baseConfig.ai,
              apiKey: undefined,
            },
          };
          const config = parseConfig(userConfig);
          expect(config.ai).toEqual({
            apiKey: "env-api-key",
            provider: "anthropic",
            model: "claude-3-5-sonnet-20241022",
          });
        });
      });

      describe("with SHORTEST_ANTHROPIC_API_KEY", () => {
        beforeEach(() => {
          process.env.SHORTEST_ANTHROPIC_API_KEY = "shortest-env-api-key";
        });

        test("uses value from SHORTEST_ANTHROPIC_API_KEY", () => {
          const userConfig = {
            ...baseConfig,
            ai: {
              ...baseConfig.ai,
              apiKey: undefined,
            },
          };
          const config = parseConfig(userConfig);
          expect(config.ai).toEqual({
            apiKey: "shortest-env-api-key",
            provider: "anthropic",
            model: "claude-3-5-sonnet-20241022",
          });
        });
      });

      describe("with ai.apiKey", () => {
        test("uses the explicit ai.apiKey", () => {
          process.env.ANTHROPIC_API_KEY = "env-api-key";
          const config = parseConfig(baseConfig);
          expect(config.ai).toEqual({
            apiKey: "explicit-api-key",
            provider: "anthropic",
            model: "claude-3-5-sonnet-20241022",
          });
        });
      });
    });

    describe("with config.anthropicKey set", () => {
      test("throws ConfigError", () => {
        const userConfig = {
          ...baseConfig,
          anthropicKey: "deprecated-api-key",
        };
        expect(() => parseConfig(userConfig)).toThrowError(
          "'config.anthropicKey' conflicts with 'config.ai.apiKey'. Please remove 'config.anthropicKey'.",
        );
      });
    });

    describe("with ai.provider unknown", () => {
      test("throws an error", () => {
        const userConfig = {
          ...baseConfig,
          ai: {
            ...baseConfig.ai,
            provider: "unknown" as any,
          },
        };
        expect(() => parseConfig(userConfig)).toThrowError(
          /Invalid shortest\.config\n(?:\u001b\[\d+m)?ai\.provider(?:\u001b\[\d+m)?: Invalid literal value, expected "anthropic" \(received: "unknown"\)/,
        );
      });
    });

    describe("with invalid ai.model", () => {
      test("throws an error", () => {
        const userConfig = {
          ...baseConfig,
          ai: { ...baseConfig.ai, model: "invalid-model" as any },
        };
        expect(() => parseConfig(userConfig)).toThrowError(
          /Invalid shortest\.config\n(?:\u001b\[\d+m)?ai\.model(?:\u001b\[\d+m)?: Invalid enum value\. Expected 'claude-3-5-sonnet-20241022' | 'claude-3-5-sonnet-latest', received 'invalid-model'(?:\s\(received: "invalid-model"\))?/,
        );
      });
    });
  });

  describe("without config.ai", () => {
    describe("without ANTHROPIC_API_KEY", () => {
      describe("with config.anthropicKey", () => {
        test("logs deprecation warning and creates config.ai", () => {
          const mockWarn = vi.fn();
          vi.spyOn(getLogger(), "warn").mockImplementation(mockWarn);

          const userConfig = {
            ...baseConfig,
            anthropicKey: "deprecated-api-key",
          };
          delete userConfig.ai;
          const config = parseConfig(userConfig);

          expect(mockWarn).toHaveBeenCalledWith(
            "'config.anthropicKey' option is deprecated. Use 'config.ai' structure instead.",
          );
          expect(config.ai).toEqual({
            provider: "anthropic",
            apiKey: "deprecated-api-key",
            model: "claude-3-5-sonnet-20241022",
          });
        });
      });

      describe("without config.anthropicKey", () => {
        test("throws an error", () => {
          const userConfig = {
            ...baseConfig,
          };
          delete userConfig.ai;
          expect(() => parseConfig(userConfig)).toThrowError(
            /Invalid shortest\.config\n(?:\u001b\[\d+m)?ai(?:\u001b\[\d+m)?: Required \(received: "undefined"\)/,
          );
        });
      });
    });
  });

  test("throws on invalid baseUrl", () => {
    const userConfig = {
      ...baseConfig,
      baseUrl: "not-a-url",
    };
    expect(() => parseConfig(userConfig)).toThrowError(
      /Invalid shortest\.config\n(?:\u001b\[\d+m)?baseUrl(?:\u001b\[\d+m)?: must be a valid URL/,
    );
  });

  test("throws on invalid testPattern", () => {
    const userConfig = {
      ...baseConfig,
      testPattern: null as any,
    };
    expect(() => parseConfig(userConfig)).toThrowError(
      /Invalid shortest\.config\n(?:\u001b\[\d+m)?testPattern(?:\u001b\[\d+m)?: Expected string, received null \(received: "null"\)/,
    );
  });

  test("throws when mailosaur.serverId is missing", () => {
    const userConfig = {
      ...baseConfig,
      mailosaur: { apiKey: "key" } as any,
    };
    expect(() => parseConfig(userConfig)).toThrowError(
      /Invalid shortest\.config\n(?:\u001b\[\d+m)?mailosaur\.serverId(?:\u001b\[\d+m)?: Required \(received: "undefined"\)/,
    );
  });
});
