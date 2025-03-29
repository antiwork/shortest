import { existsSync } from "fs";
import { readFile, writeFile } from "node:fs/promises";
import os from "os";
import { join } from "path";

export class EnvFile {
  private path: string;
  private fileName: string;
  private filePath: string;
  private _isNewFile = false;
  private _keysAdded: string[] = [];
  private _keysSkipped: string[] = [];
  private _content: string = "";
  private _existingEntries: Map<string, boolean> = new Map();
  private _eol: string = os.EOL;
  private _initialized = false;

  constructor(path: string, fileName: string) {
    this.path = path;
    this.fileName = fileName;
    this.filePath = join(path, fileName);
    this._isNewFile = !existsSync(this.filePath);
  }

  async initialize(): Promise<void> {
    if (this._initialized) return;

    try {
      this._content = await readFile(this.filePath, "utf8").catch(() => "");
      this._eol = this._content.includes("\r\n") ? "\r\n" : os.EOL;

      this._existingEntries = new Map(
        this._content
          .split(this._eol)
          .filter((line) => line.trim() && !line.startsWith("#"))
          .map((line) => {
            const [key] = line.split("=");
            return [key.trim(), true];
          }),
      );

      this._initialized = true;
    } catch (error) {
      throw error;
    }
  }

  exists(): boolean {
    return existsSync(this.filePath);
  }

  keyExists(key: string): boolean {
    return this._existingEntries.has(key);
  }

  async add(entry: {
    key: string;
    value: string;
    comment?: string;
  }): Promise<boolean> {
    if (!this._initialized) {
      await this.initialize();
    }

    const { key, value, comment } = entry;

    if (this.keyExists(key)) {
      this._keysSkipped.push(key);
      return false;
    }

    const needsEol =
      this._content.length > 0 && !this._content.endsWith(this._eol);

    if (comment) {
      this._content += `${needsEol ? this._eol : ""}# ${comment}${this._eol}`;
    }

    this._content += `${needsEol && !comment ? this._eol : ""}${key}=${value}${this._eol}`;
    this._keysAdded.push(key);
    this._existingEntries.set(key, true);

    await writeFile(this.filePath, this._content);
    return true;
  }

  keysAdded(): string[] {
    return [...this._keysAdded];
  }

  keysSkipped(): string[] {
    return [...this._keysSkipped];
  }

  isNewFile(): boolean {
    return this._isNewFile;
  }
}
