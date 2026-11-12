const DAY_MS = 86_400_000;

/** "Updated today", "Updated 3 days ago", "Updated 2 weeks ago", "Updated 5 months ago", "Updated 2 years ago": how long ago `then` was, as of `now`. */
export function updatedAgo(then: Date, now: Date): string {
  const days = Math.max(0, Math.floor((now.getTime() - then.getTime()) / DAY_MS));
  const ago = (count: number, unit: string) => `Updated ${count} ${unit}${count === 1 ? "" : "s"} ago`;
  if (days === 0) return "Updated today";
  if (days < 7) return ago(days, "day");
  if (days < 30) return ago(Math.floor(days / 7), "week");
  if (days < 365) return ago(Math.floor(days / 30), "month");
  return ago(Math.floor(days / 365), "year");
}
