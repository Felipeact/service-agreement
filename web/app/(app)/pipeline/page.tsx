import type { Metadata } from "next";
import { PipelineView } from "@/components/kanban/pipeline-view";
import { getContainer } from "@/composition";

export const metadata: Metadata = {
  title: "Pipeline",
};

export default async function PipelinePage() {
  const { pipelineBoard } = await getContainer();
  return <PipelineView cards={await pipelineBoard()} />;
}
