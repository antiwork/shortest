import crypto from "node:crypto";
// @ts-expect-error Package doesn't support Typescript
import imghash from "imghash";

export function hashData(data: unknown): string {
  const hash = crypto.createHash("sha256");
  return hash.update(JSON.stringify(data)).digest("hex");
}

/**
 * Generates a fingerprint hash for an image.
 *
 * @param image - The path to the image file as a string or a Buffer containing image data.
 * @returns A Promise that resolves to the image's fingerprint hash as a string.
 */
export async function getImageFingerprint(
  image: string | Buffer<ArrayBuffer>,
): Promise<string> {
  const hash = await imghash.hash(image, 256);
  return hash;
}

/**
 * Generates a deterministic SHA-1 hash of the given data (first 8 characters).
 *
 * @param data - The input data to be hashed.
 * @returns The first 8 characters of the SHA-1 hash.
 */
export function generateSHA1Hash(data: unknown): string {
  return crypto
    .createHash("sha1")
    .update(stableJSONStringify(data))
    .digest("hex");
}

/**
 * Ensures stable JSON serialization by sorting object keys recursively.
 *
 * @param data - The input object.
 * @returns A stringified version of the object with sorted keys.
 */
function stableJSONStringify(data: unknown): string {
  return JSON.stringify(data, Object.keys(data as object).sort());
}
