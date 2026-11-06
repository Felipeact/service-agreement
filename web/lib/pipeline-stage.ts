import { STAGE_LABELS, type PipelineStage } from "@/domain/pipeline";

/** The stage keys are owned by the domain layer (AD-001); re-exported for the UI. */
export { PIPELINE_STAGES, type PipelineStage } from "@/domain/pipeline";

type StageMeta = {
  /** Full label for pills and tooltips. */
  label: string;
  /** Label for column headers and stage tabs. */
  shortLabel: string;
  /** Background utility for the stage dot. */
  dotClass: string;
  /** The column well: an open stage is tinted with its own hue so the work in play reads by colour; a closed one is a quiet neutral. */
  wellClass: string;
  /** The tinted pill a list row wears to name its stage: the stage's soft ground with its own darker ink. */
  pillClass: string;
  /** What an empty column says: what that stage would hold, in the estimator's words. */
  emptyText: string;
  /** A small drawing above an open stage's empty text; closed stages stay plain. */
  emptySpot?: "clipboard" | "envelope" | "signature";
  /** Said beside a closed column's total so the money is not read as pipeline value; open columns have none. */
  totalNote?: string;
};

export const STAGE_META: Record<PipelineStage, StageMeta> = {
  in_progress: {
    label: STAGE_LABELS.in_progress,
    shortLabel: "In progress",
    dotClass: "bg-stage-in-progress",
    wellClass: "bg-tint-in-progress",
    pillClass: "bg-pill-in-progress text-pill-in-progress-ink",
    emptyText: "No drafts in progress",
    emptySpot: "clipboard",
  },
  sent: {
    label: STAGE_LABELS.sent,
    shortLabel: "Sent to customer",
    dotClass: "bg-stage-sent",
    wellClass: "bg-tint-sent",
    pillClass: "bg-pill-sent text-pill-sent-ink",
    emptyText: "Nothing is waiting on a customer",
    emptySpot: "envelope",
  },
  accepted: {
    label: STAGE_LABELS.accepted,
    shortLabel: "Accepted",
    dotClass: "bg-stage-accepted",
    wellClass: "bg-tint-accepted",
    pillClass: "bg-pill-accepted text-pill-accepted-ink",
    emptyText: "Nothing is waiting on a signature",
    emptySpot: "signature",
  },
  completed: {
    label: STAGE_LABELS.completed,
    shortLabel: "Completed",
    dotClass: "bg-stage-completed",
    wellClass: "bg-board/60",
    pillClass: "bg-pill-completed text-pill-completed-ink",
    emptyText: "No signed contracts yet",
    totalNote: "signed",
  },
  refused: {
    label: STAGE_LABELS.refused,
    shortLabel: "Refused",
    dotClass: "bg-stage-refused",
    wellClass: "bg-board/60",
    pillClass: "bg-pill-refused text-pill-refused-ink",
    emptyText: "No refused or expired agreements",
    totalNote: "not won",
  },
};
