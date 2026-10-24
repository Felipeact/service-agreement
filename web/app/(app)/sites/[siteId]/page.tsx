import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteRegisterView } from "@/components/sites/site-register-view";
import { getContainer } from "@/composition";

export const metadata: Metadata = { title: "Site" };

export default async function SitePage({ params }: PageProps<"/sites/[siteId]">) {
  const { siteId } = await params;
  const { siteRegister } = await getContainer();
  const site = await siteRegister(siteId);
  if (!site) notFound();
  return <SiteRegisterView site={site} />;
}
