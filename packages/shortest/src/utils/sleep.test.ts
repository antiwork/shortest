import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { sleep } from "./sleep";

describe("sleep", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves after specified milliseconds", async () => {
    const promise = sleep(1000);
    vi.advanceTimersByTime(999);

    let resolved = false;
    promise.then(() => {
      resolved = true;
    });
    expect(resolved).toBe(false);

    vi.advanceTimersByTime(1);
    await promise;
    expect(resolved).toBe(true);
  });

  it("uses setTimeout with correct delay", () => {
    const spy = vi.spyOn(global, "setTimeout");
    sleep(500);
    expect(spy).toHaveBeenCalledWith(expect.any(Function), 500);
  });
});
