import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import path from "path";
import { TestFileParser } from "@/core/runner/test-file-parser";

describe("TestFileParser", () => {
  const mockFilePath = "/path/to/test.ts";
  let parser: TestFileParser;
  
  beforeEach(() => {
    parser = new TestFileParser();
    vi.mock("fs/promises");
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe("parseFile", () => {
    it("parses a file with valid test definitions", async () => {
      const mockContent = `
        import { shortest } from "@antiwork/shortest";
        
        shortest("Test 1", async () => {
        });
        
        shortest("Test 2", async () => {
        });
      `;
      
      vi.mocked(fs.readFile).mockResolvedValueOnce(mockContent);
      
      const result = await parser.parseFile(mockFilePath);
      
      expect(result).toHaveLength(2);
      expect(result[0].name).toBe("Test 1");
      expect(result[1].name).toBe("Test 2");
    });
    
    it("handles files with no test definitions", async () => {
      const mockContent = `
        import { something } from "somewhere";
        
      `;
      
      vi.mocked(fs.readFile).mockResolvedValueOnce(mockContent);
      
      const result = await parser.parseFile(mockFilePath);
      
      expect(result).toHaveLength(0);
    });
    
    it("handles files with syntax errors gracefully", async () => {
      const mockContent = `
        import { shortest } from "@antiwork/shortest";
        
        shortest("Test with syntax error", async () => {
          const x = {; // Syntax error
        });
      `;
      
      vi.mocked(fs.readFile).mockResolvedValueOnce(mockContent);
      
      await expect(parser.parseFile(mockFilePath)).rejects.toThrow();
    });
    
    it("extracts test options correctly", async () => {
      const mockContent = `
        import { shortest } from "@antiwork/shortest";
        
        shortest("Test with options", {
          timeout: 5000,
          retry: 2
        }, async () => {
        });
      `;
      
      vi.mocked(fs.readFile).mockResolvedValueOnce(mockContent);
      
      const result = await parser.parseFile(mockFilePath);
      
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Test with options");
      expect(result[0].options).toEqual({
        timeout: 5000,
        retry: 2
      });
    });
  });
});
