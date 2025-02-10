import { describe, it, expect } from "vitest";
import { getImageFingerprint } from "@/utils/hash";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe("getImageFingerprint", () => {
  it("should generate identical fingerprints for identical images", async () => {
    const imagePath1 = join(__dirname, "../assets/images", "identical-1.png");
    const imagePath2 = join(__dirname, "../assets/images", "identical-2.png");

    const fingerprint1 = await getImageFingerprint(imagePath1);
    const fingerprint2 = await getImageFingerprint(imagePath2);

    expect(fingerprint1).toBe(fingerprint2);
  });

  it("should generate different fingerprints for similar images in bad resolution", async () => {
    const imagePath1 = join(
      __dirname,
      "../assets/images",
      "bad-resolution-1.png",
    );
    const imagePath2 = join(
      __dirname,
      "../assets/images",
      "bad-resolution-2.png",
    );

    const fingerprint1 = await getImageFingerprint(imagePath1);
    const fingerprint2 = await getImageFingerprint(imagePath2);

    expect(fingerprint1).not.toBe(fingerprint2);
  });

  it("should generate different fingerprints for medium differences", async () => {
    const imagePath1 = join(__dirname, "../assets/images", "medium-diff-1.png");
    const imagePath2 = join(__dirname, "../assets/images", "medium-diff-2.png");

    const fingerprint1 = await getImageFingerprint(imagePath1);
    const fingerprint2 = await getImageFingerprint(imagePath2);

    expect(fingerprint1).not.toBe(fingerprint2);
  });

  it("should generate different fingerprints for small differences", async () => {
    const imagePath1 = join(__dirname, "../assets/images", "small-diff-1.png");
    const imagePath2 = join(__dirname, "../assets/images", "small-diff-2.png");

    const fingerprint1 = await getImageFingerprint(imagePath1);
    const fingerprint2 = await getImageFingerprint(imagePath2);

    expect(fingerprint1).not.toBe(fingerprint2);
  });
});
