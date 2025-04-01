import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Log } from "@/log/log";
import { LogEventType } from "@/log/event";

describe("Log", () => {
  let log: Log;
  let mockListener: vi.Mock;
  
  beforeEach(() => {
    mockListener = vi.fn();
    log = new Log();
    log.addListener(mockListener);
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });
  
  describe("emit", () => {
    it("emits events to all listeners", () => {
      const type = LogEventType.INFO;
      const message = "Test message";
      
      log.emit(type, message);
      
      expect(mockListener).toHaveBeenCalledTimes(1);
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type,
          message,
        })
      );
    });
    
    it("includes metadata in events", () => {
      const type = LogEventType.INFO;
      const message = "Test message";
      const metadata = { key: "value" };
      
      log.emit(type, message, metadata);
      
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type,
          message,
          metadata,
        })
      );
    });
  });
  
  describe("addListener", () => {
    it("adds a listener that receives events", () => {
      const listener = vi.fn();
      log.addListener(listener);
      
      log.emit(LogEventType.INFO, "Test message");
      
      expect(listener).toHaveBeenCalledTimes(1);
    });
    
    it("allows adding multiple listeners", () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();
      
      log.addListener(listener1);
      log.addListener(listener2);
      
      log.emit(LogEventType.INFO, "Test message");
      
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
    });
  });
  
  describe("removeListener", () => {
    it("removes a listener", () => {
      log.removeListener(mockListener);
      
      log.emit(LogEventType.INFO, "Test message");
      
      expect(mockListener).not.toHaveBeenCalled();
    });
  });
});
