import crypto from "node:crypto";

export function generateMD5Hash(data: unknown): string {
  const input = typeof data === "string" ? data : JSON.stringify(data);
  return crypto.createHash("md5").update(input).digest("hex");
}
