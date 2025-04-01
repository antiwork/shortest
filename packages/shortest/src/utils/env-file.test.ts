import { existsSync } from "fs";
import * as fs from "node:fs/promises";
import os from "os";
import path from "path";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { EnvFile } from "./env-file";

vi.mock("fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

describe("EnvFile", () => {
  const TEST_PATH = "/test/path";
  const TEST_FILENAME = ".env.test";
  const TEST_FILE_PATH = path.join(TEST_PATH, TEST_FILENAME);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("sets isNewFile to true when file doesn't exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);
      const envFile = new EnvFile(TEST_PATH, TEST_FILENAME);

      expect(envFile.isNewFile()).toBe(true);
      expect(existsSync).toHaveBeenCalledWith(TEST_FILE_PATH);
    });

    it("sets isNewFile to false when file exists", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const envFile = new EnvFile(TEST_PATH, TEST_FILENAME);

      expect(envFile.isNewFile()).toBe(false);
      expect(existsSync).toHaveBeenCalledWith(TEST_FILE_PATH);
    });
  });

  describe("initialize", () => {
    it("reads the file content and sets up existing entries", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue("KEY1=value1\nKEY2=value2");

      const envFile = new EnvFile(TEST_PATH, TEST_FILENAME);
      await envFile.initialize();

      expect(fs.readFile).toHaveBeenCalledWith(TEST_FILE_PATH, "utf8");

      // Add a key that should be skipped because it exists
      const result = await envFile.add({ key: "KEY1", value: "new-value" });
      expect(result).toBe(false);
      expect(envFile.keysSkipped()).toContain("KEY1");
    });

    it("handles comment lines in the env file", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue(
        "# Comment\nKEY1=value1\n# Another comment\nKEY2=value2",
      );

      const envFile = new EnvFile(TEST_PATH, TEST_FILENAME);
      await envFile.initialize();

      expect(fs.readFile).toHaveBeenCalledWith(TEST_FILE_PATH, "utf8");

      // Add a key that should be added because it doesn't exist
      const result = await envFile.add({ key: "KEY3", value: "value3" });
      expect(result).toBe(true);
      expect(envFile.keysAdded()).toContain("KEY3");
    });

    it("preserves CRLF line endings if present in file", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue("KEY1=value1\r\nKEY2=value2");

      const envFile = new EnvFile(TEST_PATH, TEST_FILENAME);
      await envFile.initialize();

      // Add a new key
      await envFile.add({ key: "NEW_KEY", value: "new-value" });

      // Check that writeFile was called with CRLF endings
      expect(fs.writeFile).toHaveBeenCalledWith(
        TEST_FILE_PATH,
        expect.stringContaining("\r\n"),
      );
    });

    it("initializes only once even if called multiple times", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue("KEY1=value1\nKEY2=value2");

      const envFile = new EnvFile(TEST_PATH, TEST_FILENAME);
      await envFile.initialize();
      await envFile.initialize();

      expect(fs.readFile).toHaveBeenCalledTimes(1);
    });
  });

  describe("add", () => {
    it("adds a new key-value pair and returns true", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue("");

      const envFile = new EnvFile(TEST_PATH, TEST_FILENAME);
      const result = await envFile.add({ key: "NEW_KEY", value: "new-value" });

      expect(result).toBe(true);
      expect(envFile.keysAdded()).toContain("NEW_KEY");
      expect(fs.writeFile).toHaveBeenCalledWith(
        TEST_FILE_PATH,
        "NEW_KEY=new-value" + os.EOL,
      );
    });

    it("skips existing keys and returns false", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue("EXISTING_KEY=value");

      const envFile = new EnvFile(TEST_PATH, TEST_FILENAME);
      const result = await envFile.add({
        key: "EXISTING_KEY",
        value: "new-value",
      });

      expect(result).toBe(false);
      expect(envFile.keysSkipped()).toContain("EXISTING_KEY");
      expect(envFile.keysAdded()).not.toContain("EXISTING_KEY");
    });

    it("adds a comment if provided", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue("");

      const envFile = new EnvFile(TEST_PATH, TEST_FILENAME);
      await envFile.add({
        key: "NEW_KEY",
        value: "new-value",
        comment: "This is a comment",
      });

      expect(fs.writeFile).toHaveBeenCalledWith(
        TEST_FILE_PATH,
        "# This is a comment" + os.EOL + "NEW_KEY=new-value" + os.EOL,
      );
    });

    it("adds EOL if content doesn't end with one", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue("EXISTING_KEY=value");

      const envFile = new EnvFile(TEST_PATH, TEST_FILENAME);
      await envFile.add({ key: "NEW_KEY", value: "new-value" });

      expect(fs.writeFile).toHaveBeenCalledWith(
        TEST_FILE_PATH,
        "EXISTING_KEY=value" + os.EOL + "NEW_KEY=new-value" + os.EOL,
      );
    });

    it("automatically initializes if not already initialized", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue("");

      const envFile = new EnvFile(TEST_PATH, TEST_FILENAME);
      await envFile.add({ key: "NEW_KEY", value: "new-value" });

      expect(fs.readFile).toHaveBeenCalledWith(TEST_FILE_PATH, "utf8");
    });
  });

  describe("exists", () => {
    it("returns true when file exists", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      const envFile = new EnvFile(TEST_PATH, TEST_FILENAME);

      expect(envFile.exists()).toBe(true);
    });

    it("returns false when file doesn't exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);
      const envFile = new EnvFile(TEST_PATH, TEST_FILENAME);

      expect(envFile.exists()).toBe(false);
    });
  });

  describe("keysAdded and keysSkipped", () => {
    it("returns lists of added and skipped keys", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(fs.readFile).mockResolvedValue("EXISTING_KEY=value");

      const envFile = new EnvFile(TEST_PATH, TEST_FILENAME);
      await envFile.add({ key: "NEW_KEY1", value: "value1" });
      await envFile.add({ key: "NEW_KEY2", value: "value2" });
      await envFile.add({ key: "EXISTING_KEY", value: "new-value" });

      expect(envFile.keysAdded()).toEqual(["NEW_KEY1", "NEW_KEY2"]);
      expect(envFile.keysSkipped()).toEqual(["EXISTING_KEY"]);
    });
  });
});
