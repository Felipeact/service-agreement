/** How long ago a deal last changed: "Updated today", "Updated 1 day ago", "Updated 9 days ago". */
export function ageLabel(days: number): string {
  if (days === 0) return "Updated today";
  return `Updated ${days} ${days === 1 ? "day" : "days"} ago`;
}
