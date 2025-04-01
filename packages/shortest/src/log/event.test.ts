import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { LogEvent } from "./event";

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
    expect(event.timestamp).toEqual(new Date("2024-01-01T00:00:00.000Z"));
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

    expect(event1.timestamp).toEqual(new Date("2024-01-01T00:00:00.000Z"));
    expect(event2.timestamp).toEqual(new Date("2024-01-01T00:00:01.000Z"));
  });

  describe("parsedMetadata", () => {
    describe("when metadata is empty", () => {
      it("returns undefined", () => {
        const event = new LogEvent("info", "test");
        expect(event.parsedMetadata).toBeUndefined();
      });
    });

    describe("when metadata contains sensitive keys", () => {
      LogEvent.FILTERED_METADATA_KEYS.forEach((key) => {
        it(`filters ${key} value under 6 characters`, () => {
          const event = new LogEvent("info", "test", {
            [key]: "short",
          });
          expect(event.parsedMetadata?.[key]).toBe(
            LogEvent.FILTERED_PLACEHOLDER,
          );
        });

        it(`filters ${key} value between 6 and 15 characters`, () => {
          const event = new LogEvent("info", "test", {
            [key]: "mediumstring",
          });
          expect(event.parsedMetadata?.[key]).toBe("med...");
        });

        it(`filters ${key} value over 15 characters`, () => {
          const event = new LogEvent("info", "test", {
            [key]: "startofthestringwithend",
          });
          expect(event.parsedMetadata?.[key]).toBe("sta...end");
        });
      });
    });

    LogEvent.TRUNCATED_METADATA_KEYS.forEach((key) => {
      it(`truncates ${key} string value`, () => {
        const event = new LogEvent("info", "test", {
          [key]: "longstring",
        });
        expect(event.parsedMetadata?.[key]).toEqual("longstri...");
      });

      it(`truncates ${key} non-string value`, () => {
        const event = new LogEvent("info", "test", {
          [key]: { some: "object" },
        });
        expect(event.parsedMetadata?.[key]).toEqual(
          LogEvent.TRUNCATED_PLACEHOLDER,
        );
      });
    });

    describe("when metadata contains nested objects", () => {
      it("truncates values at max depth", () => {
        const deepObj = { a: { b: { c: { d: { e: { f: "too deep" } } } } } };
        const event = new LogEvent("info", "test", { deep: deepObj });
        const metadata = event.parsedMetadata as { deep: typeof deepObj };
        expect(metadata.deep.a.b.c.d.e.f).toBe("[TRUNCATED]");
      });

      it("handles null values", () => {
        const event = new LogEvent("info", "test", { nullKey: null });
        expect(event.parsedMetadata?.nullKey).toBeNull();
      });
    });

    describe("when metadata contains strings", () => {
      it("parses JSON strings", () => {
        const event = new LogEvent("info", "test", { json: '{"key":"value"}' });
        expect(event.parsedMetadata?.json).toEqual({ key: "value" });
      });

      it("formats multiline strings", () => {
        const event = new LogEvent("info", "test", { text: "line1\nline2" });
        expect(event.parsedMetadata?.text).toBe("\n  line1\n  line2");
      });

      it("keeps invalid JSON as is", () => {
        const event = new LogEvent("info", "test", { invalid: "{not:json}" });
        expect(event.parsedMetadata?.invalid).toBe("{not:json}");
      });
    });

    describe("caching behavior", () => {
      it("caches parsed metadata", () => {
        const event = new LogEvent("info", "test", { key: "value" });
        const firstCall = event.parsedMetadata;
        const secondCall = event.parsedMetadata;
        expect(firstCall).toBe(secondCall);
      });
    });
  });
});
