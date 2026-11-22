import { notFound, redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { importsLeftLine } from "@/domain/billing/plan-limits";
import { DEFAULT_ITEM_WORDS } from "@/domain/org-settings";

/** The org's item words for the tab title; a member with no workspace gets the default (item-vocabulary AC 6). */
export async function loadItemWords() {
  const { currentMember, getItemWords } = await getContainer();
  const member = await currentMember();
  return member.status === "member" ? await getItemWords(member.orgId) : DEFAULT_ITEM_WORDS;
}

/**
 * What the site's import page reads: the site, its import jobs, the org's item words and how many AI imports the plan has
 * left. Signed out goes to /login; a missing or foreign site is a 404.
 */
export async function loadSiteImport(siteId: string) {
  const { currentMember, siteRegister, listImportJobs, getItemWords, loadBillingUsage } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const site = await siteRegister(siteId);
  if (!site) notFound();
  const [jobs, words, usage] = await Promise.all([listImportJobs(siteId), getItemWords(member.orgId), loadBillingUsage({ orgId: member.orgId, role: member.billingRole ?? member.role })]);
  return { role: member.role, site: { id: site.id, name: site.name }, jobs, words, importsLeft: usage ? importsLeftLine(usage.aiImports) : null };
}
