import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SitesListView } from "@/components/sites/sites-list";
import { getContainer } from "@/composition";
import { DEFAULT_ITEM_WORDS } from "@/domain/org-settings";
import { parseSiteFilter } from "@/domain/records";

/** The tab title names the org's item like the page does; a member with no workspace gets the default (item-vocabulary AC 6). */
export async function generateMetadata(): Promise<Metadata> {
  const { currentMember, getItemWords } = await getContainer();
  const member = await currentMember();
  const words = member.status === "member" ? await getItemWords(member.orgId) : DEFAULT_ITEM_WORDS;
  return { title: `Sites & ${words.plural}` };
}

type Params = Parameters<typeof parseSiteFilter>[0];

/** `?q=`, `?customer=` and `?show=inactive` narrow the list; anything not valid is ignored (sites-page Surface). */
export async function SitesForRequest({ params }: { params: Params }) {
  const { currentMember, listSites, listCustomers } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const filter = parseSiteFilter(params);
  const [rows, customers] = await Promise.all([listSites(filter), listCustomers()]);
  return <SitesListView rows={rows} customers={customers} filter={filter} />;
}

export default async function SitesPage({ searchParams }: PageProps<"/sites">) {
  return <SitesForRequest params={await searchParams} />;
}
