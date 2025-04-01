import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AIProvider } from "@/ai/provider";
import { AIClientOptions } from "@/types/ai";

describe("AIProvider", () => {
  let provider: AIProvider;
  const mockOptions: AIClientOptions = {
    provider: "anthropic",
    model: "claude-3-5-sonnet-latest",
    apiKey: "test-api-key",
  };
  
  beforeEach(() => {
    provider = new AIProvider(mockOptions);
  });
  
  describe("getClient", () => {
    it("returns an AI client with the specified options", () => {
      const client = provider.getClient();
      
      expect(client).toBeDefined();
      expect(client.provider).toBe(mockOptions.provider);
      expect(client.model).toBe(mockOptions.model);
    });
    
    it("caches the client instance", () => {
      const client1 = provider.getClient();
      const client2 = provider.getClient();
      
      expect(client1).toBe(client2);
    });
  });
  
  describe("getOptions", () => {
    it("returns the provider options", () => {
      const options = provider.getOptions();
      
      expect(options).toEqual(mockOptions);
    });
  });
});
