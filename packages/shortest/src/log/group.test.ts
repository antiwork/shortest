import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { LogGroup } from "@/log/group";
import { LogEventType } from "@/log/event";

describe("LogGroup", () => {
  let group: LogGroup;
  let mockEmit: vi.Mock;
  
  beforeEach(() => {
    mockEmit = vi.fn();
    group = new LogGroup("Test Group", mockEmit);
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe("constructor", () => {
    it("initializes with the provided name and emit function", () => {
      expect(group.name).toBe("Test Group");
    });
  });
  
  describe("emit", () => {
    it("calls the provided emit function with the event type, message, and metadata", () => {
      const type = LogEventType.INFO;
      const message = "Test message";
      const metadata = { key: "value" };
      
      group.emit(type, message, metadata);
      
      expect(mockEmit).toHaveBeenCalledWith(type, message, {
        ...metadata,
        group: "Test Group",
      });
    });
    
    it("adds group name to metadata if not provided", () => {
      group.emit(LogEventType.INFO, "Test message");
      
      expect(mockEmit).toHaveBeenCalledWith(
        LogEventType.INFO,
        "Test message",
        { group: "Test Group" }
      );
    });
  });
  
  describe("info", () => {
    it("emits an info event", () => {
      const message = "Info message";
      group.info(message);
      
      expect(mockEmit).toHaveBeenCalledWith(
        LogEventType.INFO,
        message,
        { group: "Test Group" }
      );
    });
  });
  
  describe("debug", () => {
    it("emits a debug event", () => {
      const message = "Debug message";
      group.debug(message);
      
      expect(mockEmit).toHaveBeenCalledWith(
        LogEventType.DEBUG,
        message,
        { group: "Test Group" }
      );
    });
  });
  
  describe("warn", () => {
    it("emits a warn event", () => {
      const message = "Warning message";
      group.warn(message);
      
      expect(mockEmit).toHaveBeenCalledWith(
        LogEventType.WARN,
        message,
        { group: "Test Group" }
      );
    });
  });
  
  describe("error", () => {
    it("emits an error event", () => {
      const message = "Error message";
      group.error(message);
      
      expect(mockEmit).toHaveBeenCalledWith(
        LogEventType.ERROR,
        message,
        { group: "Test Group" }
      );
    });
  });
});
