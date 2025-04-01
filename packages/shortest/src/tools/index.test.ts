import { describe, expect, it } from "vitest";
import { createToolRegistry } from "@/tools";

describe("tools", () => {
  describe("createToolRegistry", () => {
    it("returns a singleton instance of ToolRegistry", () => {
      const registry1 = createToolRegistry();
      const registry2 = createToolRegistry();
      
      expect(registry1).not.toBe(registry2);
    });
  });
});
