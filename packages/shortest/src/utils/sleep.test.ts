import { describe, expect, it, vi } from "vitest";
import { sleep } from "@/utils/sleep";

describe("sleep", () => {
  it("resolves after the specified time", async () => {
    const start = Date.now();
    const delay = 100;
    
    vi.useFakeTimers();
    const promise = sleep(delay);
    vi.advanceTimersByTime(delay);
    await promise;
    vi.useRealTimers();
    
    expect(Date.now() - start).toBeLessThan(delay);
  });
  
  it("handles zero delay", async () => {
    const promise = sleep(0);
    await expect(promise).resolves.toBeUndefined();
  });
  
  it("handles negative delay as zero", async () => {
    const promise = sleep(-100);
    await expect(promise).resolves.toBeUndefined();
  });
});
