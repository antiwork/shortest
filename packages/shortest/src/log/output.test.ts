import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { LogOutput } from "@/log/output";
import { LogEvent, LogEventType } from "@/log/event";

describe("LogOutput", () => {
  let output: LogOutput;
  let mockWrite: vi.Mock;
  
  beforeEach(() => {
    mockWrite = vi.fn();
    output = new LogOutput({
      write: mockWrite,
    });
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe("constructor", () => {
    it("initializes with the provided options", () => {
      expect(output["options"].write).toBe(mockWrite);
    });
    
    it("uses default options if not provided", () => {
      const defaultOutput = new LogOutput();
      expect(defaultOutput["options"].write).toBeDefined();
    });
  });
  
  describe("onEvent", () => {
    it("formats and writes events", () => {
      const event = new LogEvent(LogEventType.INFO, "Test message");
      
      output.onEvent(event);
      
      expect(mockWrite).toHaveBeenCalledTimes(1);
      expect(mockWrite).toHaveBeenCalledWith(expect.any(String));
    });
    
    it("includes timestamp in formatted output", () => {
      const timestamp = Date.now();
      const event = new LogEvent(LogEventType.INFO, "Test message", timestamp);
      
      output.onEvent(event);
      
      const formattedOutput = mockWrite.mock.calls[0][0];
      expect(formattedOutput).toContain(new Date(timestamp).toISOString());
    });
    
    it("includes event type in formatted output", () => {
      const event = new LogEvent(LogEventType.ERROR, "Test message");
      
      output.onEvent(event);
      
      const formattedOutput = mockWrite.mock.calls[0][0];
      expect(formattedOutput).toContain("ERROR");
    });
    
    it("includes message in formatted output", () => {
      const message = "Test message";
      const event = new LogEvent(LogEventType.INFO, message);
      
      output.onEvent(event);
      
      const formattedOutput = mockWrite.mock.calls[0][0];
      expect(formattedOutput).toContain(message);
    });
    
    it("includes group in formatted output if present", () => {
      const event = new LogEvent(LogEventType.INFO, "Test message", undefined, {
        group: "Test Group",
      });
      
      output.onEvent(event);
      
      const formattedOutput = mockWrite.mock.calls[0][0];
      expect(formattedOutput).toContain("Test Group");
    });
  });
});
