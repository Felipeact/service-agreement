/** A plain JSON object: not `null` and not an array. The one guard every parser of stored or posted JSON starts from. */
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

/** An integer, not just a number. */
export const isWhole = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value);

/** The keys of `value` that are not in `allowed`. */
export const unknownKeys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).filter((key) => !allowed.includes(key));

/** Whether `url` parses and uses https; `null` and anything unparseable are not. */
export const isHttps = (url: string | null): url is string => {
  if (!url) return false;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
};
