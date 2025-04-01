import { describe, expect, it, vi } from "vitest";
import { LogConfig } from "@/log/config";
import { LogLevel } from "@/types/globals";

describe("LogConfig", () => {
  describe("constructor", () => {
    it("initializes with default values", () => {
      const config = new LogConfig();
      
      expect(config.level).toBe(LogLevel.INFO);
      expect(config.enabled).toBe(true);
    });
    
    it("accepts custom values", () => {
      const config = new LogConfig({
        level: LogLevel.DEBUG,
        enabled: false,
      });
      
      expect(config.level).toBe(LogLevel.DEBUG);
      expect(config.enabled).toBe(false);
    });
  });
  
  describe("shouldLog", () => {
    it("returns false if logging is disabled", () => {
      const config = new LogConfig({ enabled: false });
      
      expect(config.shouldLog(LogLevel.ERROR)).toBe(false);
    });
    
    it("returns true if log level is higher than or equal to config level", () => {
      const config = new LogConfig({ level: LogLevel.INFO });
      
      expect(config.shouldLog(LogLevel.INFO)).toBe(true);
      expect(config.shouldLog(LogLevel.WARN)).toBe(true);
      expect(config.shouldLog(LogLevel.ERROR)).toBe(true);
    });
    
    it("returns false if log level is lower than config level", () => {
      const config = new LogConfig({ level: LogLevel.WARN });
      
      expect(config.shouldLog(LogLevel.DEBUG)).toBe(false);
      expect(config.shouldLog(LogLevel.INFO)).toBe(false);
    });
  });
  
  describe("setLevel", () => {
    it("updates the log level", () => {
      const config = new LogConfig({ level: LogLevel.INFO });
      
      config.setLevel(LogLevel.ERROR);
      
      expect(config.level).toBe(LogLevel.ERROR);
    });
  });
  
  describe("setEnabled", () => {
    it("updates the enabled state", () => {
      const config = new LogConfig({ enabled: true });
      
      config.setEnabled(false);
      
      expect(config.enabled).toBe(false);
    });
  });
});
