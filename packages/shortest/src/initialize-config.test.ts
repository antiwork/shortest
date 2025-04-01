import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import path from "path";
import { initializeConfig } from "@/initialize-config";
import { DEFAULT_CONFIG } from "@/constants";

describe("initializeConfig", () => {
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
  
  it("creates config file if it doesn't exist", async () => {
    vi.mocked(fs.access).mockRejectedValueOnce(new Error("File not found"));
    
    await initializeConfig();
    
    expect(fs.writeFile).toHaveBeenCalledWith(
      configPath,
      expect.stringContaining("export default"),
      "utf-8"
    );
  });
  
  it("doesn't create config file if it already exists", async () => {
    vi.mocked(fs.access).mockResolvedValueOnce(undefined);
    
    await initializeConfig();
    
    expect(fs.writeFile).not.toHaveBeenCalled();
  });
  
  it("handles errors gracefully", async () => {
    vi.mocked(fs.access).mockRejectedValueOnce(new Error("File not found"));
    vi.mocked(fs.writeFile).mockRejectedValueOnce(new Error("Write error"));
    
    await expect(initializeConfig()).rejects.toThrow("Write error");
  });
  
  it("creates config with default values", async () => {
    vi.mocked(fs.access).mockRejectedValueOnce(new Error("File not found"));
    
    await initializeConfig();
    
    expect(fs.writeFile).toHaveBeenCalledWith(
      configPath,
      expect.stringContaining(JSON.stringify(DEFAULT_CONFIG, null, 2)),
      "utf-8"
    );
  });
});
