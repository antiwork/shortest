import { ZodError } from "zod";

export const formatZodError = <T>(
  error: ZodError<T>,
  label: string,
): string => {
  const errorsString = error.errors
    .map((err) => {
      const path = err.path.join(".");
      const prefix = path ? `${path}: ` : "";
      return `${prefix}${err.message}`;
    })
    .join("\n");

  return `${label}\n${errorsString}`;
};
