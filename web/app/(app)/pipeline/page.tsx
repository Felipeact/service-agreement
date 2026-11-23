import type { Metadata } from "next";
import type { MemberRole } from "@/application/ports";
import { canWriteRecords } from "@/components/records/state";
import { NewAgreementLauncher } from "../new-agreement-launcher";
import { PipelineView } from "./_components/content";
import { ExpiringView } from "./_components/expiring-view";
import { loadBoard, loadExpiring, pipelineMemberRole } from "./_data-access/pipeline";

export const metadata: Metadata = {
  title: "Pipeline",
};

/** `?view=expiring` shows Expiring soon in full; any other value, or none, shows the board, whose sixth column is Expiring soon (renewal Surface). */
export async function PipelineForRequest({ view, role, followUps = false }: { view: string | string[] | undefined; role?: MemberRole; followUps?: boolean }) {
  if (view === "expiring") {
    const { rows, today } = await loadExpiring();
    return <ExpiringView rows={rows} today={today} />;
  }
  const canCreate = role !== undefined && canWriteRecords(role);
  const { cards, expiring, imports, today } = await loadBoard();
  return (
    <PipelineView
      cards={cards}
      canCreate={canCreate}
      newAgreement={canCreate ? <NewAgreementLauncher /> : undefined}
      expiring={expiring}
      today={today}
      imports={imports}
      initialFollowUpOnly={followUps}
    />
  );
}

export default async function PipelinePage({ searchParams }: PageProps<"/pipeline">) {
  const { view, followups } = await searchParams;
  const role = await pipelineMemberRole();
  return <PipelineForRequest view={view} role={role} followUps={followups === "1"} />;
}
