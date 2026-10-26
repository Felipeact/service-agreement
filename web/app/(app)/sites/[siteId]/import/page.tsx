import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ImportPageView } from "@/components/imports/import-page-view";
import { canWriteRecords } from "@/components/records/state";
import { getContainer } from "@/composition";
import { confirmImportAction, discardImportAction, startImportAction } from "../../../import-actions";

export const metadata: Metadata = { title: "Import equipment list" };

export default async function ImportPage({ params }: PageProps<"/sites/[siteId]/import">) {
  const { siteId } = await params;
  const { currentMember, siteRegister, listImportJobs } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const site = await siteRegister(siteId);
  if (!site) notFound();
  const jobs = await listImportJobs(siteId);
  const actions = canWriteRecords(member.role)
    ? {
        start: startImportAction.bind(null, siteId),
        confirm: confirmImportAction,
        discard: (jobId: string) => discardImportAction.bind(null, jobId),
      }
    : undefined;

  return <ImportPageView site={{ id: site.id, name: site.name }} jobs={jobs} actions={actions} />;
}
