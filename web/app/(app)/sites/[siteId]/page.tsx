import type { Metadata } from "next";
import { canWriteRecords } from "@/components/records/state";
import { showInactive } from "@/domain/records";
import { createAgreementAction } from "../../agreement-actions";
import { SiteRegisterView } from "./_components/content";
import { loadSite } from "./_data-access/site";

export const metadata: Metadata = { title: "Site" };

export default async function SitePage({ params, searchParams }: PageProps<"/sites/[siteId]">) {
  const { siteId } = await params;
  const { role, site } = await loadSite(siteId);
  const newAgreement = canWriteRecords(role) ? createAgreementAction.bind(null, site.id) : undefined;
  return <SiteRegisterView site={site} role={role} newAgreement={newAgreement} showInactive={showInactive(await searchParams)} />;
}
