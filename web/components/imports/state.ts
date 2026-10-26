import type { ImportContentType } from "@/domain/imports";

type Failure = "forbidden" | "not_found" | "unavailable";

export type StartState =
  | { status: "started"; jobId: string; signedUrl: string; contentType: ImportContentType }
  | { status: "invalid"; message: string }
  | { status: Failure };

export type ConfirmState = { status: "uploaded" | "upload_missing" | Failure };

export type DiscardState = { status: "idle" | "discarded" | Failure };

/** What the upload form shows. `upload_failed`: the file never reached Storage, or never matched its job. */
export type UploadState =
  | { status: "idle" | "uploading" | "uploaded" | "upload_failed" | Failure }
  | { status: "invalid"; message: string };

export const IMPORT_FORM_MESSAGES = {
  upload_failed: "The upload didn't finish. Try again.",
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
  fetch: typeof globalThis.fetch;
};

/**
 * The browser half of the upload (door 4): start the job, PUT the bytes straight to the signed Storage URL with the
 * server's content type (never `File.type`), then confirm. A failed PUT is never confirmed.
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
  return { status: status === "upload_missing" ? "upload_failed" : status };
}
