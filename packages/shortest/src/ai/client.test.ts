import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AIClient } from "@/ai/client";
import { AIClientOptions } from "@/types/ai";

describe("AIClient", () => {
  let client: AIClient;
  const mockOptions: AIClientOptions = {
    provider: "anthropic",
    model: "claude-3-5-sonnet-latest",
    apiKey: "test-api-key",
  };
  
  beforeEach(() => {
    client = new AIClient(mockOptions);
  });
  
  describe("constructor", () => {
    it("initializes with the provided options", () => {
      expect(client.provider).toBe(mockOptions.provider);
      expect(client.model).toBe(mockOptions.model);
    });
  });
  
  describe("getSystemPrompt", () => {
    it("returns the default system prompt when none is provided", () => {
      const systemPrompt = client.getSystemPrompt();
      
      expect(systemPrompt).toBeDefined();
      expect(typeof systemPrompt).toBe("string");
      expect(systemPrompt.length).toBeGreaterThan(0);
    });
    
    it("returns the custom system prompt when provided", () => {
      const customPrompt = "Custom system prompt";
      const clientWithCustomPrompt = new AIClient({
        ...mockOptions,
        systemPrompt: customPrompt,
      });
      
      expect(clientWithCustomPrompt.getSystemPrompt()).toBe(customPrompt);
    });
  });
  
  describe("getTools", () => {
    it("returns an empty object when no tools are registered", () => {
      const tools = client.getTools();
      
      expect(tools).toEqual({});
    });
  });
});
