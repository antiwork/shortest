import { describe, expect, it, vi } from "vitest";
import { LogEvent, LogEventType } from "@/log/event";

describe("LogEvent", () => {
  it("creates an event with the specified type and message", () => {
    const type = LogEventType.INFO;
    const message = "Test message";
    
    const event = new LogEvent(type, message);
    
    expect(event.type).toBe(type);
    expect(event.message).toBe(message);
  });
  
  it("sets timestamp to current time by default", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    
    const event = new LogEvent(LogEventType.INFO, "Test message");
    
    expect(event.timestamp).toBe(now);
    
    vi.restoreAllMocks();
  });
  
  it("accepts custom timestamp", () => {
    const timestamp = 1234567890;
    
    const event = new LogEvent(LogEventType.INFO, "Test message", timestamp);
    
    expect(event.timestamp).toBe(timestamp);
  });
  
  it("accepts metadata", () => {
    const metadata = { key: "value" };
    
    const event = new LogEvent(LogEventType.INFO, "Test message", undefined, metadata);
    
    expect(event.metadata).toEqual(metadata);
  });
});
