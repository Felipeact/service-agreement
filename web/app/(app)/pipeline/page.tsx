import type { Metadata } from "next";
import { PipelineView } from "@/components/kanban/pipeline-view";
import { SAMPLE_PIPELINE } from "@/lib/sample-pipeline";

export const metadata: Metadata = {
  title: "Pipeline",
};

export default function PipelinePage() {
  return <PipelineView cards={SAMPLE_PIPELINE} />;
}
