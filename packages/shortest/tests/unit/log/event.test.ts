import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { LogEvent } from "@/log/event";

describe("LogEvent", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates an event with required properties", () => {
    const event = new LogEvent("info", "test message");

    expect(event.level).toBe("info");
    expect(event.message).toBe("test message");
    expect(event.timestamp).toBe("2024-01-01T00:00:00.000Z");
    expect(event.metadata).toEqual({});
  });

  it("creates an event with metadata", () => {
    const metadata = {
      userId: 123,
      action: "login",
    };

    const event = new LogEvent("debug", "test with metadata", metadata);

    expect(event.level).toBe("debug");
    expect(event.message).toBe("test with metadata");
    expect(event.metadata).toEqual(metadata);
  });

  it("accepts all log levels", () => {
    const levels = [
      "trace",
      "debug",
      "info",
      "warn",
      "error",
      "silent",
    ] as const;

    levels.forEach((level) => {
      const event = new LogEvent(level, "test");
      expect(event.level).toBe(level);
    });
  });

  it("creates unique timestamps for each event", () => {
    const event1 = new LogEvent("info", "first");
    vi.setSystemTime(new Date("2024-01-01T00:00:01.000Z"));
    const event2 = new LogEvent("info", "second");

    expect(event1.timestamp).toBe("2024-01-01T00:00:00.000Z");
    expect(event2.timestamp).toBe("2024-01-01T00:00:01.000Z");
  });
});
