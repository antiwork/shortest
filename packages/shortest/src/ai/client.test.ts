import { describe, expect, it, vi } from "vitest";
import { AIClient } from "@/ai/client";

vi.mock("@/ai/client", () => ({
  AIClient: vi.fn().mockImplementation(() => ({
    name: "mocked-client",
  })),
}));

describe("AI Client", () => {
  it("can be imported", () => {
    expect(AIClient).toBeDefined();
  });
});
