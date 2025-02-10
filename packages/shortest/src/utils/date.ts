export class DateUtil {
  /**
   * Converts a Date to a modified ISO string with hyphens instead of colons.
   * Example: "2025-02-10T12-34-56.789Z".
   */
  static getISODate(date: Date): string {
    return date.toISOString().replace(/:/g, "-");
  }

  /**
   * Parses a modified ISO string (with hyphens) back into a Date object.
   * Expects input like "2025-02-10T12-34-56.789Z".
   */
  static parseISODate(ISODate: string): Date {
    const [datePart, timePart] = ISODate.split("T");
    const fixedTimePart = timePart.replace(/-/g, ":");
    return new Date(`${datePart}T${fixedTimePart}`);
  }
}
