import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ImportHistoryView } from "@/components/imports/import-history";
import { getContainer } from "@/composition";
import { parseImportFilter } from "@/domain/imports";

export const metadata: Metadata = { title: "Imports" };

type Params = Parameters<typeof parseImportFilter>[0];

/** `?status=` and `?site=` narrow the list; anything not valid is ignored (imports-page Surface). */
export async function ImportsForRequest({ params }: { params: Params }) {
  const { currentMember, listImportHistory, listSites } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const filter = parseImportFilter(params);
  const [rows, sites] = await Promise.all([listImportHistory(filter), listSites({ showInactive: true })]);
  return <ImportHistoryView rows={rows} sites={sites.map((site) => ({ id: site.id, name: site.name, customer: site.customer }))} filter={filter} />;
}

export default async function ImportsPage({ searchParams }: PageProps<"/imports">) {
  return <ImportsForRequest params={await searchParams} />;
}
