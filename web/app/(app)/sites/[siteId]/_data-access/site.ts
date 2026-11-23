import { notFound, redirect } from "next/navigation";
import { getContainer } from "@/composition";

/** What the site page reads: the member's role and the site register (assets and live agreement). Signed out goes to /login; a missing or foreign id is a 404. */
export async function loadSite(siteId: string) {
  const { currentMember, siteRegister } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const site = await siteRegister(siteId);
  if (!site) notFound();
  return { role: member.role, site };
}

/** What the edit site page reads: the site and its customer, whose contacts the site may name. A missing or foreign id is a 404. */
export async function loadSiteToEdit(siteId: string) {
  const { currentMember, siteRegister, customerDetail } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const site = await siteRegister(siteId);
  const customer = site && (await customerDetail(site.customerId));
  if (!site || !customer) notFound();
  return { role: member.role, site, customer };
}

/** What the new asset page reads: the site must exist, and the org's equipment types and item words. */
export async function loadNewAsset(siteId: string) {
  const { currentMember, siteRegister, listAssetTypes, getItemWords } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  if (!(await siteRegister(siteId))) notFound();
  const [types, words] = await Promise.all([listAssetTypes(), getItemWords(member.orgId)]);
  return { role: member.role, types, words };
}
