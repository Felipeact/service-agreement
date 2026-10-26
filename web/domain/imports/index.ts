/** The largest file an import accepts: 20 MB, the same number as the `imports` bucket's `file_size_limit`. */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export const MAX_IMPORT_NAME = 255;

/** The canonical content type per accepted extension; the bucket allows exactly these four. */
const CONTENT_TYPES = {
  pdf: "application/pdf",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

export type ImportContentType = (typeof CONTENT_TYPES)[keyof typeof CONTENT_TYPES];

export const IMPORT_ACCEPT = ".xlsx,.csv,.docx,.pdf";

export const IMPORT_MESSAGES = {
  extension: "Choose an Excel (.xlsx), CSV, Word (.docx) or PDF file",
  empty: "This file is empty",
  tooLarge: "Files can be up to 20 MB",
  nameTooLong: "File name must be 255 characters or fewer",
} as const;

/** The type sent to Storage for an extension (case-insensitive), or `null` when it is not accepted. Never the browser's `File.type`. */
export function contentTypeFor(extension: string): ImportContentType | null {
  const key = extension.toLowerCase();
  return Object.hasOwn(CONTENT_TYPES, key) ? CONTENT_TYPES[key as keyof typeof CONTENT_TYPES] : null;
}

/** The text after the last dot, or `""` when there is none. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1);
}

export type ImportFileInput = { name: string; size: number };
export type ImportFile = { name: string; size: number; contentType: ImportContentType };

export function validateImportFile(input: ImportFileInput): { ok: true; value: ImportFile } | { ok: false; message: string } {
  const contentType = contentTypeFor(extensionOf(input.name));
  if (!contentType) return { ok: false, message: IMPORT_MESSAGES.extension };
  if (input.name.length > MAX_IMPORT_NAME) return { ok: false, message: IMPORT_MESSAGES.nameTooLong };
  if (!Number.isSafeInteger(input.size) || input.size <= 0) return { ok: false, message: IMPORT_MESSAGES.empty };
  if (input.size > MAX_IMPORT_BYTES) return { ok: false, message: IMPORT_MESSAGES.tooLarge };
  return { ok: true, value: { name: input.name, size: input.size, contentType } };
}

/** Under 1 MB in whole KB (at least 1), otherwise MB with one decimal. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The most data rows one file may hold across its tables (plan Assumptions). */
export const MAX_IMPORT_ROWS = 2000;

/** Why a file cannot be read; stored in `import_jobs.read_error` (door 1). */
export type ReadError = "corrupt" | "password_protected" | "no_table" | "no_text" | "too_many_rows";

export const READ_ERROR_MESSAGES: Record<ReadError, string> = {
  corrupt: "This file is damaged or isn't the format its name says.",
  password_protected:
    "This file is password-protected or saved in an older Office format. Save it as .xlsx or .docx without a password and upload it again.",
  no_table: "No table with column headings was found.",
  no_text: "This document has no text.",
  too_many_rows: "This list has more than 2,000 rows. Split it and upload each part.",
};

/** What a read recorded on the job. A PDF has no counts: Claude reads it at extraction. */
export type ReadOutcome =
  | { status: "parsed"; tables: number | null; rows: number | null }
  | { status: "unreadable"; reason: ReadError };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The line under a read job: rows and tables found, text only, or a PDF left to extraction. */
export function readSummary(tables: number | null, rows: number | null): string {
  if (tables === null || rows === null) return "PDF, read at extraction";
  if (tables === 0) return "Text only, no table";
  return `${plural(rows, "row")} in ${plural(tables, "table")}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: string): boolean {
  return UUID.test(id);
}
