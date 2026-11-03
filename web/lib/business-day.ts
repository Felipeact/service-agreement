// The business's calendar date, as `YYYY-MM-DD` (en-CA formats dates that way).
const businessDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", year: "numeric", month: "2-digit", day: "2-digit" });

/** Today in the business's time zone, so "expiring" does not shift with the server clock's offset. */
export function today(now: Date): string {
  return businessDay.format(now);
}
