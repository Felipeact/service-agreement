import type { Metadata } from "next";
import { ExpiringView } from "@/components/kanban/expiring-view";
import { PipelineView } from "@/components/kanban/pipeline-view";
import { canWriteRecords } from "@/components/records/state";
import { getContainer } from "@/composition";
import type { MemberRole } from "@/application/ports";
import { today as businessDay } from "@/lib/business-day";
import { greetingLine } from "@/lib/greeting";
import { NewAgreementLauncher } from "../new-agreement-launcher";

export const metadata: Metadata = {
  title: "Pipeline",
};

/** `?view=expiring` shows Expiring soon in full; any other value, or none, shows the board, whose sixth column is Expiring soon (renewal Surface). */
export async function PipelineForRequest({ view, role, email = "", followUps = false }: { view: string | string[] | undefined; role?: MemberRole; email?: string; followUps?: boolean }) {
  const { pipelineBoard, pipelineExpiring, listImportHistory, clock } = await getContainer();
  const today = businessDay(clock.now());
  if (view === "expiring") {
    return <ExpiringView rows={await pipelineExpiring(today)} today={today} />;
  }
  const canCreate = role !== undefined && canWriteRecords(role);
  const [cards, expiring, imports] = await Promise.all([pipelineBoard(), pipelineExpiring(today), listImportHistory({})]);
  return (
    <PipelineView
      cards={cards}
      title={greetingLine(clock.now(), email)}
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
  const member = await (await getContainer()).currentMember();
  return <PipelineForRequest view={view} role={member.status === "member" ? member.role : undefined} email={member.status === "member" ? member.email : ""} followUps={followups === "1"} />;
}
