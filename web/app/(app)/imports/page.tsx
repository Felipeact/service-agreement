import type { Metadata } from "next";
import { canWriteRecords } from "@/components/records/state";
import { parseImportFilter } from "@/domain/imports";
import { ImportBannerLauncher } from "../new-agreement-launcher";
import { ImportHistoryView } from "./_components/content";
import { loadImports } from "./_data-access/imports";

export const metadata: Metadata = { title: "Imports" };

type Params = Parameters<typeof parseImportFilter>[0];

/** `?status=` and `?site=` narrow the list; anything not valid is ignored (imports-page Surface). */
export async function ImportsForRequest({ params }: { params: Params }) {
  const filter = parseImportFilter(params);
  const { role, rows, sites, words } = await loadImports(filter);
  return <ImportHistoryView rows={rows} sites={sites} filter={filter} words={words} banner={canWriteRecords(role) ? <ImportBannerLauncher /> : undefined} />;
}

export default async function ImportsPage({ searchParams }: PageProps<"/imports">) {
  return <ImportsForRequest params={await searchParams} />;
}
