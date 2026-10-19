/** The board stage a deal shows at. Ordered; the Phase 1 domain layer owns these keys (AD-001). */
export const PIPELINE_STAGES = ["in_progress", "sent", "accepted", "completed", "refused"] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

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
