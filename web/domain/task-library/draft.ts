import { MAX_TASK_DESCRIPTION, validateTypeName } from "./index";

export const MAX_DRAFT_TYPES = 30;
export const MAX_DRAFT_TASKS = 15;
export const MAX_DRAFT_SPELLINGS = 10;
export const MAX_SPELLING_LENGTH = 60;

/** One proposed type, as Claude drafts it and the owner reviews it (other-trade-draft door 1). Never persisted as a draft. */
export type DraftType = {
  name: string;
  defaultVisitMonths: number[];
  synonyms: string[];
  tasks: { description: string }[];
};

export type DraftTypeErrors = { name?: string; months?: string; tasks?: string };

export const DRAFT_MESSAGES = {
  name: "Name the type in 1 to 60 characters, with at least one letter or number",
  months: "Choose at least one month",
  tasks: "Add at least one task of 1 to 200 characters",
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

function monthsOf(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const months = value.filter((m): m is number => Number.isInteger(m) && m >= 1 && m <= 12);
  return [...new Set(months)].sort((a, b) => a - b);
}

function synonymsOf(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const spellings = value
    .filter((s): s is string => typeof s === "string")
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length >= 1 && s.length <= MAX_SPELLING_LENGTH && /[\p{L}\p{N}]/u.test(s));
  return [...new Set(spellings)].slice(0, MAX_DRAFT_SPELLINGS);
}

function tasksOf(value: unknown): { description: string }[] {
  if (!Array.isArray(value)) return [];
  const tasks: { description: string }[] = [];
  for (const task of value) {
    const description = isRecord(task) && typeof task.description === "string" ? task.description.trim() : "";
    if (description.length >= 1 && description.length <= MAX_TASK_DESCRIPTION) tasks.push({ description });
  }
  return tasks.slice(0, MAX_DRAFT_TASKS);
}

/**
 * Cleans a draft from Claude, or one a browser sends back, into types the database will accept: an invalid piece is dropped,
 * a type left with no task or no month is dropped, a name already kept (ignoring case) is dropped, and the first 30 types are kept.
 * Anything that is not `{ types: [...] }` is an empty draft.
 */
export function normalizeDraft(raw: unknown): DraftType[] {
  const list = isRecord(raw) && Array.isArray(raw.types) ? raw.types : [];
  const kept: DraftType[] = [];
  const names = new Set<string>();
  for (const item of list) {
    if (!isRecord(item) || typeof item.name !== "string") continue;
    const name = validateTypeName(item.name);
    if (!name.ok || names.has(name.name.toLowerCase())) continue;
    const type: DraftType = { name: name.name, defaultVisitMonths: monthsOf(item.defaultVisitMonths), synonyms: synonymsOf(item.synonyms), tasks: tasksOf(item.tasks) };
    if (type.defaultVisitMonths.length === 0 || type.tasks.length === 0) continue;
    names.add(type.name.toLowerCase());
    kept.push(type);
    if (kept.length === MAX_DRAFT_TYPES) break;
  }
  return kept;
}

/** What is wrong with a type the owner has edited, field by field; an empty object means it can be added. */
export function draftTypeErrors(type: DraftType): DraftTypeErrors {
  const errors: DraftTypeErrors = {};
  if (!validateTypeName(type.name).ok) errors.name = DRAFT_MESSAGES.name;
  if (type.defaultVisitMonths.length === 0) errors.months = DRAFT_MESSAGES.months;
  const valid = type.tasks.filter((task) => task.description.trim().length >= 1 && task.description.trim().length <= MAX_TASK_DESCRIPTION);
  if (valid.length === 0 || valid.length !== type.tasks.length) errors.tasks = DRAFT_MESSAGES.tasks;
  return errors;
}

export type DraftErrorCode = "invalid_input" | "signed_out" | "forbidden" | "not_available" | "file_too_large" | "unsupported_type" | "unreadable" | "empty_draft" | "unavailable";

/** The words for each way a draft request fails, shared by the route's answer and the panel (a network failure has no answer to read). */
export const DRAFT_ERROR_MESSAGES: Record<DraftErrorCode, string> = {
  invalid_input: "Describe the trade in up to 1,000 characters, or choose a proposal to read.",
  signed_out: "Your session ended. Sign in again to continue.",
  forbidden: "You don't have permission to change this.",
  not_available: "Drafting a catalog is only available while you set up a new workspace.",
  file_too_large: "That file is over 5 MB. Choose a smaller one, or describe the trade instead.",
  unsupported_type: "Choose a PDF or a Word (.docx) file. A spreadsheet is imported from a site instead.",
  unreadable: "We couldn't read that file. Choose another one, or describe the trade instead.",
  empty_draft: "We couldn't draft any types from that. Add more detail about what you service and try again.",
  unavailable: "We couldn't draft your catalog right now. Try again in a moment.",
};

/** A proposal that read fine but is more than one answer can cover. */
export const DRAFT_TOO_LARGE_MESSAGE = "That proposal is too long for one draft. Upload fewer pages, or describe the trade instead.";
