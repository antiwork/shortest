import { ShortestError } from "@/utils/errors";

export const assert: (condition: boolean, msg?: string) => asserts condition = (
  condition: boolean,
  msg = "Assertion failed",
): asserts condition => {
  if (!condition) {
    throw new ShortestError(msg);
  }
};

export const assertDefined = <T>(value: T, msg?: string): NonNullable<T> => {
  assert(value != null, msg);
  return value as NonNullable<T>;
};
