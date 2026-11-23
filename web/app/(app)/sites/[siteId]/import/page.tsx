import type { Metadata } from "next";
import { canWriteRecords } from "@/components/records/state";
import { isUuid } from "@/domain/imports";
import { confirmImportAction, discardImportAction, extractImportAction, readImportAction, startImportAction } from "../../../import-actions";
import { ImportPageView } from "./_components/content";
import { loadItemWords, loadSiteImport } from "./_data-access/import";

/** The tab title names the org's item like the page does (item-vocabulary AC 6). */
export async function generateMetadata(): Promise<Metadata> {
  return { title: `Import ${(await loadItemWords()).singular} list` };
}

export default async function ImportPage({ params, searchParams }: PageProps<"/sites/[siteId]/import">) {
  const { siteId } = await params;
  const { agreement } = await searchParams;
  const { role, site, jobs, words, importsLeft } = await loadSiteImport(siteId);
  const actions = canWriteRecords(role)
    ? {
        start: startImportAction.bind(null, siteId),
        confirm: confirmImportAction,
        discard: (jobId: string) => discardImportAction.bind(null, jobId),
        read: readImportAction,
        extract: extractImportAction,
      }
    : undefined;

  const agreementId = typeof agreement === "string" && isUuid(agreement) ? agreement : undefined;
  return <ImportPageView site={site} jobs={jobs} actions={actions} agreementId={agreementId} words={words} importsLeft={importsLeft} />;
}
