import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ImportPageView } from "@/components/imports/import-page-view";
import { canWriteRecords } from "@/components/records/state";
import { getContainer } from "@/composition";
import { isUuid } from "@/domain/imports";
import { DEFAULT_ITEM_WORDS } from "@/domain/org-settings";
import { confirmImportAction, discardImportAction, extractImportAction, readImportAction, startImportAction } from "../../../import-actions";

/** The tab title names the org's item like the page does (item-vocabulary AC 6). */
export async function generateMetadata(): Promise<Metadata> {
  const { currentMember, getItemWords } = await getContainer();
  const member = await currentMember();
  const words = member.status === "member" ? await getItemWords(member.orgId) : DEFAULT_ITEM_WORDS;
  return { title: `Import ${words.singular} list` };
}

export default async function ImportPage({ params, searchParams }: PageProps<"/sites/[siteId]/import">) {
  const { siteId } = await params;
  const { agreement } = await searchParams;
  const { currentMember, siteRegister, listImportJobs, getItemWords } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const site = await siteRegister(siteId);
  if (!site) notFound();
  const [jobs, words] = await Promise.all([listImportJobs(siteId), getItemWords(member.orgId)]);
  const actions = canWriteRecords(member.role)
    ? {
        start: startImportAction.bind(null, siteId),
        confirm: confirmImportAction,
        discard: (jobId: string) => discardImportAction.bind(null, jobId),
        read: readImportAction,
        extract: extractImportAction,
      }
    : undefined;

  const agreementId = typeof agreement === "string" && isUuid(agreement) ? agreement : undefined;
  return <ImportPageView site={{ id: site.id, name: site.name }} jobs={jobs} actions={actions} agreementId={agreementId} words={words} />;
}
