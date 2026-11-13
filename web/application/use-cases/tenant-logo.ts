import type { OrgLogo } from "@/application/ports";
import type { TenantLogo } from "@/domain/org-settings/logo";

/**
 * The org's logo as a document draws it: the org's stored `logo_path`, then its bytes. Never throws: a document without its
 * logo beats no document, so a failing read is logged once and answers `null` (tenant-logo AC 19).
 */
export function makeTenantLogo(logo: Pick<OrgLogo, "current" | "load">) {
  return async function tenantLogo(orgId: string): Promise<TenantLogo | null> {
    try {
      return await logo.load(await logo.current(orgId));
    } catch (cause) {
      console.error(`Reading the logo of org ${orgId} failed, so the document has none: ${cause instanceof Error ? cause.message : String(cause)}`);
      return null;
    }
  };
}
