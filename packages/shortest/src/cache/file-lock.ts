import fs from "node:fs";

export class FileLock {
  constructor(
    private lockFile: string,
    private timeoutMs: number = 1000,
  ) {}

  async acquire(): Promise<boolean> {
    const startTime = Date.now();
    let failures = 0;

    while (Date.now() - startTime < this.timeoutMs) {
      try {
        if (fs.existsSync(this.lockFile)) {
          const lockAge = Date.now() - fs.statSync(this.lockFile).mtimeMs;
          if (lockAge > this.timeoutMs) {
            fs.unlinkSync(this.lockFile);
          }
        }
        fs.writeFileSync(this.lockFile, process.pid.toString(), { flag: "wx" });
        return true;
      } catch {
        failures++;
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
    }

    if (failures >= 3 && fs.existsSync(this.lockFile)) {
      try {
        fs.unlinkSync(this.lockFile);
      } catch {
        // Fallthrough
      }
    }
    return false;
  }

  release(): void {
    if (fs.existsSync(this.lockFile)) {
      try {
        fs.unlinkSync(this.lockFile);
      } catch {
        // Fallthrough
      }
    }
  }
}
