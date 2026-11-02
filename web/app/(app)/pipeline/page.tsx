import type { Metadata } from "next";
import { ExpiringView } from "@/components/kanban/expiring-view";
import { PipelineView } from "@/components/kanban/pipeline-view";
import { getContainer } from "@/composition";

export const metadata: Metadata = {
  title: "Pipeline",
};

// The business's calendar date, as `YYYY-MM-DD` (en-CA formats dates that way).
const businessDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Vancouver", year: "numeric", month: "2-digit", day: "2-digit" });

/** `?view=expiring` shows Expiring soon; any other value, or none, shows the board (renewal Surface). */
export async function PipelineForRequest({ view }: { view: string | string[] | undefined }) {
  const { pipelineBoard, pipelineExpiring, clock } = await getContainer();
  if (view === "expiring") {
    const today = businessDay.format(clock.now());
    return <ExpiringView rows={await pipelineExpiring(today)} today={today} />;
  }
  return <PipelineView cards={await pipelineBoard()} />;
}

export default async function PipelinePage({ searchParams }: PageProps<"/pipeline">) {
  const { view } = await searchParams;
  return <PipelineForRequest view={view} />;
}
