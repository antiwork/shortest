import { describe, test, expect, beforeEach } from "vitest";
import { ShortestConfig } from "@/types";
import { parseConfig } from "@/utils/config";

describe("Config parsing", () => {
  let baseConfigWithAnthropic: ShortestConfig;
  let baseConfigWithOpenAI: ShortestConfig;

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
    baseConfigWithAnthropic = {
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
        ...baseConfigWithAnthropic,
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
        ...baseConfigWithAnthropic,
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
        ...baseConfigWithAnthropic,
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
        ...baseConfigWithAnthropic,
        ai: {
          ...baseConfigWithAnthropic.ai,
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
          ...baseConfigWithAnthropic,
          ai: {
            ...baseConfigWithAnthropic.ai,
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
            ...baseConfigWithAnthropic,
            ai: {
              ...baseConfigWithAnthropic.ai,
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
            ...baseConfigWithAnthropic,
            ai: {
              ...baseConfigWithAnthropic.ai,
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
          const config = parseConfig(baseConfigWithAnthropic);
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
          ...baseConfigWithAnthropic,
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
          ...baseConfigWithAnthropic,
          ai: {
            ...baseConfigWithAnthropic.ai,
            provider: "unknown" as any,
          },
        };
        expect(() => parseConfig(userConfig)).toThrowError(
          /Invalid shortest\.config\n(?:\u001b\[\d+m)?ai\.provider(?:\u001b\[\d+m)?: Invalid value, expected 'anthropic' | 'openai'/,
        );
      });
    });

    describe("with Anthropic provider", () => {
      beforeEach(() => {
        delete process.env.ANTHROPIC_API_KEY;
        delete process.env.SHORTEST_ANTHROPIC_API_KEY;
      });

      test("validates Anthropic configuration", () => {
        const userConfig = {
          ...baseConfigWithAnthropic,
          ai: {
            provider: "anthropic" as const,
            apiKey: "anthropic-key",
          },
        };
        const config = parseConfig(userConfig);
        expect(config.ai).toEqual({
          provider: "anthropic",
          apiKey: "anthropic-key",
          model: "claude-3-5-sonnet-20241022",
        });
      });

      test("throws error without Anthropic API key", () => {
        const userConfig = {
          ...baseConfigWithAnthropic,
          ai: {
            provider: "anthropic" as const,
            apiKey: undefined,
          },
        };
        expect(() => parseConfig(userConfig)).toThrowError(
          /Invalid shortest\.config\n(?:\u001b\[\d+m)?ai\.apiKey(?:\u001b\[\d+m)?: Required \(received: "undefined"\)/,
        );
      });

      describe("with invalid ai.model", () => {
        test("throws an error", () => {
          const userConfig = {
            ...baseConfigWithAnthropic,
            ai: {
              ...baseConfigWithAnthropic.ai,
              model: "invalid-model" as any,
            },
          };
          expect(() => parseConfig(userConfig)).toThrowError(
            /Invalid shortest\.config\n(?:\u001b\[\d+m)?ai\.model(?:\u001b\[\d+m)?: Invalid value\. Expected 'claude-3-5-sonnet-20241022' | 'claude-3-5-sonnet-latest', received 'invalid-model'(?:\s\(received: "invalid-model"\))?/,
          );
        });
      });
    });

    describe("with OpenAI provider", () => {
      beforeEach(() => {
        baseConfigWithOpenAI = {
          ...baseConfigWithAnthropic,
          ai: {
            provider: "openai",
            apiKey: "openai-key",
          },
        };
      });

      test("validates OpenAI configuration", () => {
        const userConfig = {
          ...baseConfigWithOpenAI,
        };
        const config = parseConfig(userConfig);
        expect(config.ai).toEqual({
          provider: "openai",
          apiKey: "openai-key",
          model: "computer-use-preview-2025-02-04",
        });
      });

      test("throws error without OpenAI API key", () => {
        const userConfig = {
          ...baseConfigWithOpenAI,
          ai: {
            ...baseConfigWithOpenAI.ai,
            apiKey: undefined,
          },
        };
        expect(() => parseConfig(userConfig)).toThrowError(
          /Invalid shortest\.config\n(?:\u001b\[\d+m)?ai\.apiKey(?:\u001b\[\d+m)?: Required \(received: "undefined"\)/,
        );
      });

      test("uses OPENAI_API_KEY from environment", () => {
        process.env.OPENAI_API_KEY = "env-openai-key";
        const userConfig = {
          ...baseConfigWithOpenAI,
          ai: {
            ...baseConfigWithOpenAI.ai,
            apiKey: undefined,
          },
        };
        const config = parseConfig(userConfig);
        expect(config.ai).toEqual({
          provider: "openai",
          apiKey: "env-openai-key",
          model: "computer-use-preview-2025-02-04",
        });
      });

      test("uses SHORTEST_OPENAI_API_KEY from environment", () => {
        process.env.SHORTEST_OPENAI_API_KEY = "shortest-env-openai-key";
        const userConfig = {
          ...baseConfigWithOpenAI,
          ai: {
            ...baseConfigWithOpenAI.ai,
            apiKey: undefined,
          },
        };
        const config = parseConfig(userConfig);
        expect(config.ai).toEqual({
          provider: "openai",
          apiKey: "shortest-env-openai-key",
          model: "computer-use-preview-2025-02-04",
        });
      });

      describe("with invalid ai.model", () => {
        test("throws an error", () => {
          const userConfig = {
            ...baseConfigWithOpenAI,
            ai: { ...baseConfigWithOpenAI.ai, model: "invalid-model" as any },
          };
          expect(() => parseConfig(userConfig)).toThrowError(
            /Invalid shortest\.config\n(?:\u001b\[\d+m)?ai\.model(?:\u001b\[\d+m)?: Invalid value\. Expected 'computer-use-preview-2025-02-04', received 'invalid-model'(?:\s\(received: "invalid-model"\))?/,
          );
        });
      });
    });
  });

  test("throws on invalid baseUrl", () => {
    const userConfig = {
      ...baseConfigWithAnthropic,
      baseUrl: "not-a-url",
    };
    expect(() => parseConfig(userConfig)).toThrowError(
      /Invalid shortest\.config\n(?:\u001b\[\d+m)?baseUrl(?:\u001b\[\d+m)?: must be a valid URL/,
    );
  });

  test("throws on invalid testPattern", () => {
    const userConfig = {
      ...baseConfigWithAnthropic,
      testPattern: null as any,
    };
    expect(() => parseConfig(userConfig)).toThrowError(
      /Invalid shortest\.config\n(?:\u001b\[\d+m)?testPattern(?:\u001b\[\d+m)?: Expected string, received null \(received: "null"\)/,
    );
  });

  test("throws when mailosaur.serverId is missing", () => {
    const userConfig = {
      ...baseConfigWithAnthropic,
      mailosaur: { apiKey: "key" } as any,
    };
    expect(() => parseConfig(userConfig)).toThrowError(
      /Invalid shortest\.config\n(?:\u001b\[\d+m)?mailosaur\.serverId(?:\u001b\[\d+m)?: Required \(received: "undefined"\)/,
    );
  });
});
