import { spawn } from "child_process";
import { getLogger, Log } from "@/log";
import { asShortestError } from "@/utils/errors";

// eslint-disable-next-line zod/require-zod-schema-types
type BashToolError = "timeout" | "network" | "unknown" | "unauthorized";

export class BashTool {
  private log: Log;

  constructor() {
    this.log = getLogger();
  }

  public execute(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, { shell: true });

      let output = "";
      let errorOutput = "";

      child.stdout.on("data", (data) => {
        output += data.toString();
      });

      child.stderr.on("data", (data) => {
        errorOutput += data.toString();
        if (this.getErrorType(data.toString()) === "timeout") {
          this.log.debug("Timeout error occurred, retrying...");
        }
      });

      child.on("exit", (code) => {
        if (code === 0) {
          resolve(output.trim());
        } else {
          // Still resolve even if there is no successfull output
          resolve(
            errorOutput.trim() ||
              `Process exited with code ${code ? code.toString() : "unknown"}`,
          );
        }
      });

      child.on("error", (err) => {
        reject(new Error(`Error spawning process: ${err.message}`));
        throw asShortestError(err);
      });
    });
  }

  /**
   * Check the type of error from the provided stderr buffer
   * @param data Linux / PowerShell stderr buffer
   * @returns The type of error (e.g., "timeout", "network", etc)
   */
  private getErrorType(data: string): BashToolError {
    // Unauthorized error (401) specific to Clerk
    const unauthorizedRegex = /401 Unauthorized/i;
    if (unauthorizedRegex.test(data)) {
      return "unauthorized";
    }

    const timeoutRegex = /timeout|retrying in|request timed out/i;
    if (timeoutRegex.test(data)) {
      return "timeout";
    }

    const networkErrorRegex =
      /Could not resolve host|Name or service not known|connection refused|ENOTFOUND/i;
    if (networkErrorRegex.test(data)) {
      return "network";
    }

    return "unknown";
  }
}
