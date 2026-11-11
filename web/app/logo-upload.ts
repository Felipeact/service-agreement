"use server";

import { getContainer } from "@/composition";
import { checkLogoFile } from "@/domain/org-settings/logo";
import { canEditSettings } from "@/components/settings/state";

export type LogoUploadAnswer = { ok: true; path: string; signedUrl: string; contentType: string } | { ok: false; error: string };

const NOT_ALLOWED = "You don't have permission to change this.";
const UNAVAILABLE = "Logo upload failed, try again";

/**
 * The first half of a logo upload (tenant-logo door 1): the file's type and size are checked again here, only an owner or admin
 * is answered, and what comes back is a signed URL for a new key of the member's own org. The browser PUTs the bytes there.
 */
export async function prepareLogoUpload(file: { type: string; size: number }): Promise<LogoUploadAnswer> {
  const { currentMember, logo } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member" || !canEditSettings(member.role)) return { ok: false, error: NOT_ALLOWED };

  const checked = checkLogoFile(file);
  if (!checked.ok) return checked;

  const prepared = await logo.prepareUpload(member.orgId, checked.ext);
  return prepared.ok ? { ok: true, path: prepared.path, signedUrl: prepared.signedUrl, contentType: file.type } : { ok: false, error: UNAVAILABLE };
}
