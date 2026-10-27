import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { SiteRegisterView } from "@/components/sites/site-register-view";
import { canWriteRecords } from "@/components/records/state";
import { getContainer } from "@/composition";
import { createAgreementAction } from "../../agreement-actions";

export const metadata: Metadata = { title: "Site" };

export default async function SitePage({ params }: PageProps<"/sites/[siteId]">) {
  const { siteId } = await params;
  const { currentMember, siteRegister } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const site = await siteRegister(siteId);
  if (!site) notFound();
  const newAgreement = canWriteRecords(member.role) ? createAgreementAction.bind(null, site.id) : undefined;
  return <SiteRegisterView site={site} role={member.role} newAgreement={newAgreement} />;
}
