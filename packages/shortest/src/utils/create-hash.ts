import crypto from "crypto";

/**
 * Creates a SHA-256 hash of the given data.
 * @param {unknown} data - The data to hash.
 * @param {Object} [options] - Optional settings.
 * @param {number} [options.length] - Length of the hash to return.
 * @returns {string} The resulting hash string.
 * @private
 */
export const createHash = (
  data: unknown,
  options?: { length?: number },
): string => {
  const hash = crypto.createHash("sha256");
  const hashString = hash.update(JSON.stringify(data)).digest("hex");
  return options?.length ? hashString.slice(0, options.length) : hashString;
};
