import type { PipelineStage } from "@/domain/pipeline";

/** The stage keys are owned by the domain layer (AD-001); re-exported for the UI. */
export { PIPELINE_STAGES, type PipelineStage } from "@/domain/pipeline";

type StageMeta = {
  /** Full label for pills and tooltips. */
  label: string;
  /** Label for column headers and stage tabs. */
  shortLabel: string;
  /** Background utility for the stage dot. */
  dotClass: string;
};

export const STAGE_META: Record<PipelineStage, StageMeta> = {
  in_progress: { label: "In progress", shortLabel: "In progress", dotClass: "bg-stage-in-progress" },
  sent: { label: "Sent to customer", shortLabel: "Sent to customer", dotClass: "bg-stage-sent" },
  accepted: { label: "Accepted, awaiting signature", shortLabel: "Accepted", dotClass: "bg-stage-accepted" },
  completed: { label: "Completed", shortLabel: "Completed", dotClass: "bg-stage-completed" },
  refused: { label: "Refused", shortLabel: "Refused", dotClass: "bg-stage-refused" },
};
