import crypto from "crypto";

export const createHash = (data: unknown): string => {
  const hash = crypto.createHash("sha256");
  return hash.update(JSON.stringify(data)).digest("hex");
};
