import { describe, expect, it, vi, beforeEach } from "vitest";
import { LogGroup } from "./group";
import { Log } from "./log";

describe("LogGroup", () => {
  let mockLog: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockLog = {
      log: vi.fn(),
    };
  });

  it("creates a group with name and log instance", () => {
    const group = new LogGroup(mockLog as unknown as Log, "TestGroup");
    expect(group.name).toBe("TestGroup");
    expect(group.parent).toBeUndefined();
  });

  it("creates a nested group with parent", () => {
    const parentGroup = new LogGroup(mockLog as unknown as Log, "Parent");
    const childGroup = new LogGroup(
      mockLog as unknown as Log,
      "Child",
      parentGroup,
    );
    expect(childGroup.parent).toBe(parentGroup);
  });

  it("returns group identifiers in hierarchical order", () => {
    const root = new LogGroup(mockLog as unknown as Log, "Root");
    const parent = new LogGroup(mockLog as unknown as Log, "Parent", root);
    const child = new LogGroup(mockLog as unknown as Log, "Child", parent);

    expect(child.getGroupIdentifiers()).toEqual(["Root", "Parent", "Child"]);
  });

  describe("logging methods", () => {
    let group: LogGroup;

    beforeEach(() => {
      group = new LogGroup(mockLog as unknown as Log, "TestGroup");
    });

    it("logs info messages", () => {
      group.info("test message", {
        meta: "data",
      });
      expect(mockLog.log).toHaveBeenCalledWith("info", "test message", {
        meta: "data",
      });
    });

    it("logs warn messages", () => {
      group.warn("test warning", {
        meta: "data",
      });
      expect(mockLog.log).toHaveBeenCalledWith("warn", "test warning", {
        meta: "data",
      });
    });

    it("logs error messages", () => {
      group.error("test error", {
        meta: "data",
      });
      expect(mockLog.log).toHaveBeenCalledWith("error", "test error", {
        meta: "data",
      });
    });

    it("logs debug messages", () => {
      group.debug("test debug", {
        meta: "data",
      });
      expect(mockLog.log).toHaveBeenCalledWith("debug", "test debug", {
        meta: "data",
      });
    });

    it("logs trace messages", () => {
      group.trace("test trace", {
        meta: "data",
      });
      expect(mockLog.log).toHaveBeenCalledWith("trace", "test trace", {
        meta: "data",
      });
    });

    it("supports method chaining", () => {
      const result = group.info("info").debug("debug").warn("warn");

      expect(result).toBe(group);
      expect(mockLog.log).toHaveBeenCalledTimes(3);
    });
  });
});
