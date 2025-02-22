import crypto from "crypto";

export const createHash = (
  data: unknown,
  options?: { length?: number },
): string => {
  const hash = crypto.createHash("sha256");
  const hashString = hash.update(JSON.stringify(data)).digest("hex");
  return options?.length ? hashString.slice(0, options.length) : hashString;
};
