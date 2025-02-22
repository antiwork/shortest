import { TestContext, TestFunction } from "@/types";
import { hashData } from "@/utils/crypto";

export class TestCase implements TestFunction {
  readonly name!: string | "Untitled";
  readonly filePath!: string;
  readonly payload?: any;
  readonly fn?: (context: TestContext) => Promise<void>;
  readonly expectations?: {
    description?: string;
    payload?: any;
    fn?: (context: TestContext) => Promise<void>;
    directExecution?: boolean;
  }[];
  readonly beforeFn?: (context: TestContext) => void | Promise<void>;
  readonly afterFn?: (context: TestContext) => void | Promise<void>;
  readonly directExecution?: boolean;
  readonly identifier: string;

  constructor({
    name = "Untitled",
    filePath,
    payload,
    fn,
    expectations,
    beforeFn,
    afterFn,
    directExecution,
  }: Omit<TestFunction, "name"> & { name?: string | "Untitled" }) {
    Object.assign(this, {
      name,
      filePath,
      payload,
      fn,
      expectations,
      beforeFn,
      afterFn,
      directExecution,
    });
    this.identifier = hashData(this);
  }
}
