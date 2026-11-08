import { isVisitMonths } from "../agreement/cadence";

export const MAX_LIBRARY_TASKS = 40;
export const MAX_TASK_DESCRIPTION = 200;
export const MAX_TYPE_NAME = 60;
export const TYPE_NAME_MESSAGE = `Name the type in 1 to ${MAX_TYPE_NAME} characters, with at least one letter or number`;

export type LibraryTask = { description: string; visitMonths: number[] | null };

/** An equipment type with its default visit months and checklist (task-library-page). */
export type LibraryType = {
  id: string;
  code: string;
  name: string;
  /** The pack the type was seeded from, or `null` for one made by hand (type-editor door 2). */
  pack: string | null;
  defaultVisitMonths: number[];
  tasks: LibraryTask[];
};

/** A checklist row as the form submits it: month numbers as text, no months meaning every visit. */
export type TaskInput = { description: string; visitMonths: string[] };
export type TaskLibraryInput = { typeCode: string; defaultVisitMonths: string[]; tasks: TaskInput[] };
export type TaskLibraryValue = { defaultVisitMonths: number[]; tasks: LibraryTask[] };

export type RowErrors = { description?: string; visitMonths?: string };
export type TaskLibraryErrors = { defaultVisitMonths?: string; tasks?: string; rows?: Record<number, RowErrors> };

export const TASK_LIBRARY_MESSAGES = {
  months: "Choose at least one month, in order, from January to December",
  description: `Describe the task in 1 to ${MAX_TASK_DESCRIPTION} characters`,
  tooMany: `A checklist can have up to ${MAX_LIBRARY_TASKS} tasks`,
} as const;

/** The type to show: the one `code` names, else the first, else `null` when the library is empty. */
export function pickType(types: LibraryType[], code: string | string[] | undefined): LibraryType | null {
  const wanted = typeof code === "string" ? code : "";
  return types.find((type) => type.code === wanted) ?? types[0] ?? null;
}

function parseMonths(values: string[]): number[] | null {
  if (!values.every((value) => /^\d{1,2}$/.test(value))) return null;
  const months = values.map(Number);
  return isVisitMonths(months) ? months : null;
}

/** Checks the whole type before anything is written (AC 8, 10-14). Months are not reordered: the grid sends them ascending. */
export function validateTaskLibraryType(input: TaskLibraryInput): { ok: true; value: TaskLibraryValue } | { ok: false; errors: TaskLibraryErrors } {
  const errors: TaskLibraryErrors = {};
  const defaults = parseMonths(input.defaultVisitMonths);
  if (!defaults) errors.defaultVisitMonths = TASK_LIBRARY_MESSAGES.months;
  if (input.tasks.length > MAX_LIBRARY_TASKS) errors.tasks = TASK_LIBRARY_MESSAGES.tooMany;

  const tasks: LibraryTask[] = [];
  input.tasks.forEach((row, index) => {
    const description = row.description.trim();
    const rowErrors: RowErrors = {};
    if (description.length < 1 || description.length > MAX_TASK_DESCRIPTION) rowErrors.description = TASK_LIBRARY_MESSAGES.description;
    const months = row.visitMonths.length === 0 ? null : parseMonths(row.visitMonths);
    if (row.visitMonths.length > 0 && !months) rowErrors.visitMonths = TASK_LIBRARY_MESSAGES.months;
    if (Object.keys(rowErrors).length > 0) (errors.rows ??= {})[index] = rowErrors;
    tasks.push({ description, visitMonths: months });
  });

  if (errors.defaultVisitMonths || errors.tasks || errors.rows || !defaults) return { ok: false, errors };
  return { ok: true, value: { defaultVisitMonths: defaults, tasks } };
}

/** The name an owner or admin typed for a type, trimmed, or why it cannot be used (type-editor AC 4). */
export function validateTypeName(raw: string): { ok: true; name: string } | { ok: false; message: string } {
  const name = raw.trim();
  if (name.length < 1 || name.length > MAX_TYPE_NAME || !/[A-Za-z0-9]/.test(name)) return { ok: false, message: TYPE_NAME_MESSAGE };
  return { ok: true, name };
}
