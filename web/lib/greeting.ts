/** The hour of the day in the business's time zone, 0 to 23. */
function hourIn(now: Date, timeZone: string): number {
  return Number(new Intl.DateTimeFormat("en-CA", { hour: "numeric", hour12: false, timeZone }).format(now)) % 24;
}

/** "Good morning" before noon, "Good afternoon" until 5pm, "Good evening" after, by the business's clock. */
export function greetingFor(now: Date, timeZone = "America/Vancouver"): string {
  const hour = hourIn(now, timeZone);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/**
 * A first name to greet someone by, read from their email's local part when it plainly holds one ("jamie.walsh@x.com" gives
 * "Jamie"). A local part that is one long run of letters ("felipetiburcioviana") is not guessed at: it returns `null`, and the
 * greeting goes without a name until the app stores one.
 */
export function firstNameFromEmail(email: string): string | null {
  if (!email.includes("@")) return null;
  const local = email.split("@")[0] ?? "";
  const first = local.split(/[._+\-\d]+/).find((part) => part.length > 0) ?? "";
  if (!/^[a-z]{2,12}$/i.test(first)) return null;
  // Without a separator the whole local part is one token: only a short one reads as a first name.
  if (first.length === local.length && first.length > 9) return null;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

/** "Good morning, Jamie", or just "Good morning" when no name is known. */
export function greetingLine(now: Date, email: string, timeZone?: string): string {
  const name = firstNameFromEmail(email);
  return `${greetingFor(now, timeZone)}${name ? `, ${name}` : ""}`;
}
