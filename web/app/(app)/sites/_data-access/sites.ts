import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { DEFAULT_ITEM_WORDS } from "@/domain/org-settings";
import type { SiteFilter } from "@/domain/records";

/** What the Sites page reads: the sites the filter asks for and the customers to filter by. Signed out goes to /login. */
export async function loadSites(filter: SiteFilter) {
  const { currentMember, listSites, listCustomers } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const [rows, customers] = await Promise.all([listSites(filter), listCustomers()]);
  return { rows, customers };
}

/** The org's item words for the tab title; a member with no workspace gets the default (item-vocabulary AC 6). */
export async function loadItemWords() {
  const { currentMember, getItemWords } = await getContainer();
  const member = await currentMember();
  return member.status === "member" ? await getItemWords(member.orgId) : DEFAULT_ITEM_WORDS;
}
