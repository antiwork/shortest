import { constants } from "fs";
import * as fs from "fs/promises";

export const directoryExists = async (path: string) => {
  try {
    await fs.access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};
