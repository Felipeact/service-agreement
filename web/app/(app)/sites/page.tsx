import type { Metadata } from "next";
import { parseSiteFilter } from "@/domain/records";
import { SitesListView } from "./_components/content";
import { loadItemWords, loadSites } from "./_data-access/sites";

/** The tab title names the org's item like the page does; a member with no workspace gets the default (item-vocabulary AC 6). */
export async function generateMetadata(): Promise<Metadata> {
  return { title: `Sites & ${(await loadItemWords()).plural}` };
}

type Params = Parameters<typeof parseSiteFilter>[0];

/** `?q=`, `?customer=` and `?show=inactive` narrow the list; anything not valid is ignored (sites-page Surface). */
export async function SitesForRequest({ params }: { params: Params }) {
  const filter = parseSiteFilter(params);
  const { rows, customers } = await loadSites(filter);
  return <SitesListView rows={rows} customers={customers} filter={filter} />;
}

export default async function SitesPage({ searchParams }: PageProps<"/sites">) {
  return <SitesForRequest params={await searchParams} />;
}
