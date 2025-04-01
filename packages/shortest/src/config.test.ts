import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import path from "path";
import { loadConfig } from "@/config";
import { DEFAULT_CONFIG } from "@/constants";

describe("config", () => {
  const mockCwd = "/mock/cwd";
  const configPath = path.join(mockCwd, "shortest.config.ts");
  
  beforeEach(() => {
    vi.mock("fs/promises");
    vi.mock("path", () => ({
      join: vi.fn((...args) => args.join("/")),
      resolve: vi.fn((...args) => args.join("/")),
    }));
    vi.mock("process", () => ({
      cwd: vi.fn(() => mockCwd),
    }));
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe("loadConfig", () => {
    it("loads config from file if it exists", async () => {
      const mockConfig = {
        ...DEFAULT_CONFIG,
        browser: {
          ...DEFAULT_CONFIG.browser,
          headless: false,
        },
      };
      
      vi.mock(configPath, () => ({
        default: mockConfig,
      }), { virtual: true });
      
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);
      
      const config = await loadConfig();
      
      expect(config).toEqual(mockConfig);
    });
    
    it("returns default config if file doesn't exist", async () => {
      vi.mocked(fs.access).mockRejectedValueOnce(new Error("File not found"));
      
      const config = await loadConfig();
      
      expect(config).toEqual(DEFAULT_CONFIG);
    });
    
    it("merges partial config with defaults", async () => {
      const partialConfig = {
        browser: {
          headless: false,
        },
      };
      
      vi.mock(configPath, () => ({
        default: partialConfig,
      }), { virtual: true });
      
      vi.mocked(fs.access).mockResolvedValueOnce(undefined);
      
      const config = await loadConfig();
      
      expect(config.browser.headless).toBe(false);
      expect(config.ai).toEqual(DEFAULT_CONFIG.ai);
    });
  });
});
