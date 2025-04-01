import { describe, expect, it, vi } from "vitest";
import { createProvider } from "@/ai/provider";

vi.mock("@/ai/provider", () => ({
  createProvider: vi.fn().mockReturnValue({
    name: "mocked-provider",
  }),
}));

describe("AI Provider", () => {
  it("can be imported", () => {
    expect(createProvider).toBeDefined();
  });
});
