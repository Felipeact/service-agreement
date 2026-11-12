/** One drafted type: what the owner reviews, and what `add_catalog_draft` writes (other-trade-draft door 1). */
export type DraftType = { name: string; months: number[]; tasks: string[] };

export const MAX_DRAFT_TYPES = 40;
export const MAX_DRAFT_TASKS = 12;
/** The same bound as `private.clean_type_name`. */
export const MAX_TYPE_NAME = 60;
export const MAX_TASK_LENGTH = 200;
export const MAX_TRADE_LENGTH = 60;
/** The trade becomes part of `org_settings.trade_context`, whose database check allows exactly this alphabet. */
const TRADE_PATTERN = /^[A-Za-z0-9 ,&/'-]+$/;

/** The trade name trimmed, or `null` when it is empty, over 60 characters, holds a character outside the alphabet or has no letter or digit. */
export function validateTrade(text: string): string | null {
  const trade = text.trim();
  if (trade.length < 1 || trade.length > MAX_TRADE_LENGTH) return null;
  return TRADE_PATTERN.test(trade) && /[A-Za-z0-9]/.test(trade) ? trade : null;
}

const isText = (value: unknown, max: number): value is string => typeof value === "string" && value.trim().length >= 1 && value.trim().length <= max;

function readType(raw: unknown): DraftType | null {
  if (!raw || typeof raw !== "object") return null;
  const { name, months, tasks } = raw as Record<string, unknown>;
  if (!isText(name, MAX_TYPE_NAME) || !/[A-Za-z0-9]/.test(name)) return null;
  if (!Array.isArray(months) || months.length < 1 || months.length > 12) return null;
  if (!months.every((m) => Number.isInteger(m) && m >= 1 && m <= 12)) return null;
  if (!Array.isArray(tasks) || tasks.length > MAX_DRAFT_TASKS || !tasks.every((t) => isText(t, MAX_TASK_LENGTH))) return null;
  return {
    name: name.trim(),
    months: [...new Set(months as number[])].sort((a, b) => a - b),
    tasks: (tasks as string[]).map((t) => t.trim()),
  };
}

/**
 * A draft as far as it is valid: 1 to 40 types, each with a name, 1 to 12 months and 0 to 12 tasks inside their bounds, and no two names
 * equal ignoring case. Months come back sorted and without repeats, the shape the database requires. Anything else is `null`.
 */
export function validateDraft(input: unknown): DraftType[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_DRAFT_TYPES) return null;
  const types: DraftType[] = [];
  for (const raw of input) {
    const type = readType(raw);
    if (!type) return null;
    types.push(type);
  }
  return new Set(types.map((t) => t.name.toLowerCase())).size === types.length ? types : null;
}
