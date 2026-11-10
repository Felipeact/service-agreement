/** The API version this code was written against (billing-checkout door 1); a response shape is never read from the account default. */
export const STRIPE_VERSION = "2026-10-28.endive";

export const STRIPE_TIMEOUT_MS = 10_000;

export type FormValue = string | number | FormValue[] | { [key: string]: FormValue };

/** Stripe's form encoding: nested keys as `a[b][c]`, arrays as `a[0]`. */
export function encodeForm(value: FormValue, prefix = ""): string[] {
  if (typeof value === "object") {
    const entries = Array.isArray(value) ? value.map((item, index): [string, FormValue] => [String(index), item]) : Object.entries(value);
    return entries.flatMap(([key, item]) => encodeForm(item, prefix ? `${prefix}[${key}]` : key));
  }
  return [`${encodeURIComponent(prefix)}=${encodeURIComponent(String(value))}`];
}

/** Stripe's `error.code`, only when it looks like a code, so a message or a value Stripe echoes never reaches the log. */
export function errorCode(body: unknown): string | undefined {
  const code = (body as { error?: { code?: unknown } } | null)?.error?.code;
  return typeof code === "string" && /^[a-z_]{1,64}$/.test(code) ? code : undefined;
}
