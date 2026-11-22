import { CheckIcon } from "lucide-react";
import type { PipelineStage } from "@/lib/pipeline-stage";

const STEPS: { stage: PipelineStage; label: string }[] = [
  { stage: "in_progress", label: "In progress" },
  { stage: "sent", label: "Sent" },
  { stage: "accepted", label: "Accepted" },
  { stage: "completed", label: "Signed" },
];

/** Where the agreement stands on its way to a signed contract: four steps, the ones reached filled. A refused agreement has no path to show. */
export function ProgressSteps({ stage }: { stage: PipelineStage }) {
  const reached = STEPS.findIndex((step) => step.stage === stage);
  if (reached === -1) return null;
  return (
    <ol aria-label="Progress" className="grid grid-cols-4 gap-1 rounded-panel border border-hairline bg-surface p-3 shadow-card">
      {STEPS.map((step, index) => (
        <li key={step.stage} aria-current={index === reached ? "step" : undefined} className="flex flex-col items-center gap-1.5 text-center">
          <span className={`flex size-7 items-center justify-center rounded-full text-[12px] font-bold ${index <= reached ? "bg-action text-surface" : "bg-board text-ink-2"}`}>
            {index < reached ? <CheckIcon aria-hidden="true" className="size-4" /> : index + 1}
          </span>
          <span className={`text-[12px] font-semibold ${index <= reached ? "text-ink" : "text-ink-2"}`}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}
