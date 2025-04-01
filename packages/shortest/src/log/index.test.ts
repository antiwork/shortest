import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getLogger, Logger } from "@/log";
import { LogEventType } from "@/log/event";

describe("log", () => {
  describe("getLogger", () => {
    it("returns a singleton instance of Logger", () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      
      expect(logger1).toBe(logger2);
    });
  });
  
  describe("Logger", () => {
    let logger: Logger;
    let mockEmit: vi.SpyInstance;
    
    beforeEach(() => {
      logger = new Logger();
      mockEmit = vi.spyOn(logger, "emit").mockImplementation(() => {});
    });
    
    afterEach(() => {
      vi.resetAllMocks();
    });
    
    it("emits info events", () => {
      const message = "Info message";
      logger.info(message);
      
      expect(mockEmit).toHaveBeenCalledWith(LogEventType.INFO, message);
    });
    
    it("emits debug events", () => {
      const message = "Debug message";
      logger.debug(message);
      
      expect(mockEmit).toHaveBeenCalledWith(LogEventType.DEBUG, message);
    });
    
    it("emits warn events", () => {
      const message = "Warning message";
      logger.warn(message);
      
      expect(mockEmit).toHaveBeenCalledWith(LogEventType.WARN, message);
    });
    
    it("emits error events", () => {
      const message = "Error message";
      logger.error(message);
      
      expect(mockEmit).toHaveBeenCalledWith(LogEventType.ERROR, message);
    });
  });
});
