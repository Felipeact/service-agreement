import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SitesListView } from "@/components/sites/sites-list";
import { getContainer } from "@/composition";
import { parseSiteFilter } from "@/domain/records";

export const metadata: Metadata = { title: "Sites & equipment" };

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
