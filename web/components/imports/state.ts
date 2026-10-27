import type { ImportContentType, ReadError } from "@/domain/imports";
import type { AssetInput, FieldErrors } from "@/domain/records";

type Failure = "forbidden" | "not_found" | "unavailable";

export type StartState =
  | { status: "started"; jobId: string; signedUrl: string; contentType: ImportContentType }
  | { status: "invalid"; message: string }
  | { status: Failure };

export type ConfirmState = { status: "uploaded" | "upload_missing" | Failure };

export type DiscardState = { status: "idle" | "discarded" | "locked" | Failure };

/** What `readImportAction` answers: the recorded outcome, or why nothing was read. */
export type ReadState =
  | { status: "parsed"; tables: number | null; rows: number | null }
  | { status: "unreadable"; reason: ReadError }
  | { status: "not_ready" | Failure };

/** What the row actions answer (`updateImportRowAction`, `skipImportRowAction`). */
export type RowState =
  | { status: "idle" | "saved" | "locked" | Failure }
  | { status: "invalid"; errors: FieldErrors<keyof AssetInput> };

/** What `mapImportTypeAction` answers. */
export type MapState = { status: "idle" | "invalid" | "locked" | Failure } | { status: "mapped"; rows: number };

/** What `commitImportAction` answers. */
export type CommitState =
  | { status: "idle" | "nothing_to_add" | "not_ready" | Failure }
  | { status: "committed"; added: number; skipped: number }
  | { status: "incomplete"; count: number };

/** The review's alerts, by state; each names what to do next. */
export const REVIEW_MESSAGES = {
  row_unavailable: "We couldn't save this row. Try again.",
  commit_unavailable: "We couldn't add these assets. Try again.",
  locked: "This import was already added to the site.",
  forbidden: "You don't have permission to import equipment lists.",
  not_found: "This import no longer exists.",
  not_ready: "This import isn't ready to add yet.",
  nothing_to_add: "Include at least one row to add.",
  invalid: "Choose an equipment type",
} as const;

/** What `extractImportAction` answers: progress, the finished counts, or why nothing moved. */
export type ExtractState =
  | { status: "extracting"; done: number; total: number }
  | { status: "extracted"; rows: number; unmatched: number }
  | { status: "not_ready" | "too_large" | Failure };

export const EXTRACT_MESSAGES = {
  unavailable: "We couldn't read this list. Try again.",
  too_large: "This document lists more equipment than can be read at once. Split it and upload each part.",
  not_ready: "The upload didn't finish. Try again.",
  forbidden: "You don't have permission to import equipment lists.",
  not_found: "This import no longer exists.",
} as const;

type ExtractDeps = {
  extract: (jobId: string) => Promise<ExtractState>;
  onProgress?: (progress: { done: number; total: number }) => void;
};

/** Calls `extract` once per chunk until the job is extracted or something stops it, and returns that last answer. */
export async function runExtraction(jobId: string, { extract, onProgress }: ExtractDeps): Promise<ExtractState> {
  for (;;) {
    const answer = await extract(jobId);
    if (answer.status !== "extracting") return answer;
    onProgress?.({ done: answer.done, total: answer.total });
  }
}

/**
 * What the upload form shows. `upload_failed`: the file never reached Storage, or never matched its job. `reading`: the
 * file is stored and being read; `read_failed`: the read hit an unexpected error and the job stays "Uploaded".
 */
export type UploadState =
  | { status: "idle" | "uploading" | "uploaded" | "upload_failed" | "reading" | "read_failed" | Failure }
  | { status: "invalid"; message: string }
  | ReadState;

export const IMPORT_FORM_MESSAGES = {
  upload_failed: "The upload didn't finish. Try again.",
  read_failed: "We couldn't read the file. Try again.",
  forbidden: "You don't have permission to import equipment lists.",
  not_found: "This site no longer exists.",
  unavailable: "We couldn't upload the file. Try again.",
} as const;

/** The message under the form for a state, or `null` when there is none. */
export function uploadMessage(state: UploadState): string | null {
  if (state.status === "invalid") return state.message;
  if (state.status in IMPORT_FORM_MESSAGES) return IMPORT_FORM_MESSAGES[state.status as keyof typeof IMPORT_FORM_MESSAGES];
  return null;
}

type UploadDeps = {
  start: (formData: FormData) => Promise<StartState>;
  confirm: (jobId: string) => Promise<ConfirmState>;
  read: (jobId: string) => Promise<ReadState>;
  fetch: typeof globalThis.fetch;
  /** Called once the file is stored, just before it is read. */
  onReading?: () => void;
};

/**
 * The browser half of the upload (door 4): start the job, PUT the bytes straight to the signed Storage URL with the
 * server's content type (never `File.type`), confirm, then read the stored file. A failed PUT is never confirmed, and
 * a file never confirmed is never read.
 */
export async function uploadFile(file: File, deps: UploadDeps): Promise<UploadState> {
  const form = new FormData();
  form.set("fileName", file.name);
  form.set("size", String(file.size));
  const started = await deps.start(form);
  if (started.status !== "started") return started;

  try {
    const response = await deps.fetch(started.signedUrl, {
      method: "PUT",
      body: file,
      headers: { "content-type": started.contentType, "x-upsert": "false" },
    });
    if (!response.ok) return { status: "upload_failed" };
  } catch {
    return { status: "upload_failed" };
  }

  const { status } = await deps.confirm(started.jobId);
  if (status !== "uploaded") return { status: status === "upload_missing" ? "upload_failed" : status };
  deps.onReading?.();
  return deps.read(started.jobId);
}
