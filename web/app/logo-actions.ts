"use server";

import { getContainer } from "@/composition";
import { isOwnLogoPath, LOGO_PATH_ERROR } from "@/domain/org-settings/logo";
import { canEditSettings } from "@/components/settings/state";

const NOT_ALLOWED = "You don't have permission to change this.";
const UNAVAILABLE = "The logo could not be saved, try again";

/** The member's org logo key, `null` for none or for someone who is not signed in. The template editor shows it in the header card. */
export async function currentLogoPath(): Promise<string | null> {
  const { currentMember, logo } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") return null;
  return logo.current(member.orgId).catch(() => null);
}

/**
 * Stores a logo uploaded from the template editor (`prepareLogoUpload` made the key), or removes it when `path` is `""`. Only the
 * logo changes: every other setting is saved as it is now. The same logo is the one Settings shows. The replaced file is deleted.
 */
export async function saveLogoPath(path: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const { currentMember, getOrgSettings, saveOrgSettings, logo } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member" || !canEditSettings(member.role)) return { ok: false, error: NOT_ALLOWED };
  if (!isOwnLogoPath(member.orgId, path)) return { ok: false, error: LOGO_PATH_ERROR };

  const previous = await logo.current(member.orgId).catch(() => null);
  const current = await getOrgSettings(member.orgId);
  if (!current) return { ok: false, error: UNAVAILABLE };
  const { companyConfirmedAt: _confirmed, ...settings } = current;
  const saved = await saveOrgSettings(member.orgId, { ...settings, logoPath: path === "" ? null : path });
  if (!saved.ok) return { ok: false, error: UNAVAILABLE };
  if (previous && previous !== path) await logo.remove(previous);
  return { ok: true };
}
