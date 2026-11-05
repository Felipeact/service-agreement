import type { Metadata } from "next";
import { ExpiringView } from "@/components/kanban/expiring-view";
import { PipelineView } from "@/components/kanban/pipeline-view";
import { canWriteRecords } from "@/components/records/state";
import { getContainer } from "@/composition";
import type { MemberRole } from "@/application/ports";
import { today as businessDay } from "@/lib/business-day";

export const metadata: Metadata = {
  title: "Pipeline",
};

/** `?view=expiring` shows Expiring soon; any other value, or none, shows the board (renewal Surface). */
export async function PipelineForRequest({ view, role }: { view: string | string[] | undefined; role?: MemberRole }) {
  const { pipelineBoard, pipelineExpiring, clock } = await getContainer();
  if (view === "expiring") {
    const today = businessDay(clock.now());
    return <ExpiringView rows={await pipelineExpiring(today)} today={today} />;
  }
  return <PipelineView cards={await pipelineBoard()} canCreate={role !== undefined && canWriteRecords(role)} />;
}

export default async function PipelinePage({ searchParams }: PageProps<"/pipeline">) {
  const { view } = await searchParams;
  const member = await (await getContainer()).currentMember();
  return <PipelineForRequest view={view} role={member.status === "member" ? member.role : undefined} />;
}
