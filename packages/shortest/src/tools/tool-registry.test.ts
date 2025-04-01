import { Tool } from "ai";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { z } from "zod";
import { ToolRegistry } from "./tool-registry";
import { BrowserTool } from "@/browser/core/browser-tool";
import { ShortestError } from "@/utils/errors";

describe("ToolRegistry", () => {
  let registry: ToolRegistry;
  let mockBrowserTool: BrowserTool;

  const createMockTool = (name: string): Tool =>
    ({
      parameters: z.object({}),
      description: `Mock ${name} tool`,
      execute: vi.fn().mockResolvedValue(`Executed ${name}`),
      __meta: { name },
    }) as unknown as Tool;

  beforeEach(() => {
    registry = new ToolRegistry();

    mockBrowserTool = {} as BrowserTool;
  });

  describe("registerTool", () => {
    it("registers a tool successfully", () => {
      const toolEntry = {
        name: "mockTool",
        category: "custom" as const,
        factory: (_browserTool: BrowserTool) => createMockTool("mockTool"),
      };

      registry.registerTool("mock_tool", toolEntry);

      const tools = registry.getTools(
        "anthropic",
        "claude-3-5-sonnet-latest",
        mockBrowserTool,
      );
      expect(tools).toHaveProperty("mockTool");
    });

    it("throws an error when registering a duplicate tool", () => {
      const toolEntry = {
        name: "mockTool",
        category: "custom" as const,
        factory: (_browserTool: BrowserTool) => createMockTool("mockTool"),
      };

      registry.registerTool("mock_tool", toolEntry);

      expect(() => {
        registry.registerTool("mock_tool", toolEntry);
      }).toThrow("Tool with key 'mock_tool' already registered");
    });
  });

  describe("getTools", () => {
    it("returns custom tools", () => {
      const customToolEntry = {
        name: "customTool",
        category: "custom" as const,
        factory: (_browserTool: BrowserTool) => createMockTool("customTool"),
      };

      registry.registerTool("custom_tool", customToolEntry);

      const tools = registry.getTools(
        "anthropic",
        "claude-3-5-sonnet-latest",
        mockBrowserTool,
      );
      expect(tools).toHaveProperty("customTool");
    });

    it("returns provider tools", () => {
      const computerToolEntry = {
        name: "computer",
        category: "provider" as const,
        factory: (_browserTool: BrowserTool) => createMockTool("computer"),
      };

      registry.registerTool("anthropic_computer_20241022", computerToolEntry);

      const tools = registry.getTools(
        "anthropic",
        "claude-3-5-sonnet-latest",
        mockBrowserTool,
      );
      expect(tools).toHaveProperty("computer");
    });

    it("returns bash tool without requiring browserTool argument", () => {
      const bashToolEntry = {
        name: "bash",
        category: "provider" as const,
        factory: () => createMockTool("bash"),
      };

      registry.registerTool("anthropic_bash_20241022", bashToolEntry);

      const tools = registry.getTools(
        "anthropic",
        "claude-3-5-sonnet-latest",
        mockBrowserTool,
      );
      expect(tools).toHaveProperty("bash");
    });

    it("combines provider and custom tools", () => {
      const customToolEntry = {
        name: "customTool",
        category: "custom" as const,
        factory: (_browserTool: BrowserTool) => createMockTool("customTool"),
      };

      const providerToolEntry = {
        name: "computer",
        category: "provider" as const,
        factory: (_browserTool: BrowserTool) => createMockTool("computer"),
      };

      const bashToolEntry = {
        name: "bash",
        category: "provider" as const,
        factory: () => createMockTool("bash"),
      };

      registry.registerTool("custom_tool", customToolEntry);
      registry.registerTool("anthropic_computer_20241022", providerToolEntry);
      registry.registerTool("anthropic_bash_20241022", bashToolEntry);

      const tools = registry.getTools(
        "anthropic",
        "claude-3-5-sonnet-latest",
        mockBrowserTool,
      );

      expect(tools).toHaveProperty("customTool");
      expect(tools).toHaveProperty("computer");
      expect(tools).toHaveProperty("bash");
      expect(Object.keys(tools).length).toBe(3);
    });

    it("handles missing provider tools gracefully", () => {
      const customToolEntry = {
        name: "customTool",
        category: "custom" as const,
        factory: (_browserTool: BrowserTool) => createMockTool("customTool"),
      };

      registry.registerTool("custom_tool", customToolEntry);

      const tools = registry.getTools(
        "anthropic",
        "claude-3-5-sonnet-latest",
        mockBrowserTool,
      );

      expect(tools).toHaveProperty("customTool");
      expect(Object.keys(tools).length).toBe(1);
    });

    it("respects model-specific tool versions", () => {
      const computerToolLatest = {
        name: "computer",
        category: "provider" as const,
        factory: (_browserTool: BrowserTool) =>
          createMockTool("computer-latest"),
      };

      registry.registerTool("anthropic_computer_20241022", computerToolLatest);
      registry.registerTool("anthropic_computer_20250124", computerToolLatest);

      const tools35Latest = registry.getTools(
        "anthropic",
        "claude-3-5-sonnet-latest",
        mockBrowserTool,
      );
      const tools35Fixed = registry.getTools(
        "anthropic",
        "claude-3-5-sonnet-20241022",
        mockBrowserTool,
      );
      const tools37Latest = registry.getTools(
        "anthropic",
        "claude-3-7-sonnet-latest",
        mockBrowserTool,
      );
      const tools37Fixed = registry.getTools(
        "anthropic",
        "claude-3-7-sonnet-20250219",
        mockBrowserTool,
      );

      expect(tools35Latest).toHaveProperty("computer");
      expect(tools35Fixed).toHaveProperty("computer");
      expect(tools37Latest).toHaveProperty("computer");
      expect(tools37Fixed).toHaveProperty("computer");
    });
  });

  describe("getProviderToolEntry", () => {
    it("throws ShortestError when tool not found", () => {
      const getProviderToolEntry = (registry as any).getProviderToolEntry.bind(
        registry,
      );

      expect(() => {
        getProviderToolEntry(
          "anthropic",
          "claude-3-5-sonnet-latest",
          "computer",
        );
      }).toThrow(ShortestError);

      expect(() => {
        getProviderToolEntry(
          "anthropic",
          "claude-3-5-sonnet-latest",
          "computer",
        );
      }).toThrow(
        "computer tool not found for key: anthropic_computer_20241022",
      );
    });
  });
});
