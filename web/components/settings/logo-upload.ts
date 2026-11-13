import type { LogoUploadAnswer } from "@/app/logo-upload";
import { checkLogoFile } from "@/domain/org-settings/logo";

export const LOGO_UPLOAD_FAILED = "Logo upload failed, try again";

export type LogoPicked = { type: string; size: number };

export type LogoUploadDeps<F extends LogoPicked> = {
  /** The server half: checks the file again and returns a signed URL for a new key (`prepareLogoUpload`). */
  prepare: (file: LogoPicked) => Promise<LogoUploadAnswer>;
  /** Sends the bytes to the signed URL with the server's content type; `true` when Storage accepted them. */
  put: (signedUrl: string, file: F, contentType: string) => Promise<boolean>;
};

export type LogoUploadResult = { ok: true; path: string } | { ok: false; error: string };

/**
 * The browser half of a logo upload (tenant-logo door 1): refuse a file outside the rule without asking the server, ask for a
 * signed URL, PUT the bytes straight to Storage. Nothing is stored on the org until the form is saved, so a failure here leaves
 * the stored logo as it was.
 */
export async function uploadLogo<F extends LogoPicked>(file: F, deps: LogoUploadDeps<F>): Promise<LogoUploadResult> {
  const checked = checkLogoFile(file);
  if (!checked.ok) return checked;
  try {
    const prepared = await deps.prepare({ type: file.type, size: file.size });
    if (!prepared.ok) return { ok: false, error: prepared.error };
    return (await deps.put(prepared.signedUrl, file, prepared.contentType)) ? { ok: true, path: prepared.path } : { ok: false, error: LOGO_UPLOAD_FAILED };
  } catch {
    return { ok: false, error: LOGO_UPLOAD_FAILED };
  }
}

/** The browser's PUT of the bytes to the signed Storage URL. */
export async function putToStorage(signedUrl: string, file: Blob, contentType: string): Promise<boolean> {
  const response = await fetch(signedUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
  return response.ok;
}
