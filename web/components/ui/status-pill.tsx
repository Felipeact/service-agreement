import { STAGE_META, type PipelineStage } from "@/lib/pipeline-stage";

type StatusPillProps = {
  /** Always required: colour never carries meaning alone. */
  label: string;
} & (
  | { stage: PipelineStage; tone?: never }
  | { tone: "attention" | "neutral"; stage?: never }
);

const TONE_CLASSES = {
  attention: "bg-attention-bg text-attention-fg",
  neutral: "bg-board text-ink-2",
};

/** A stage renders as a coloured dot beside its label; a tone renders as a tinted pill. */
export function StatusPill({ label, stage, tone }: StatusPillProps) {
  if (stage) {
    return (
      <span className="inline-flex items-center gap-2 font-semibold text-ink" title={STAGE_META[stage].label}>
        <span data-stage-dot={stage} aria-hidden="true" className={`size-2 shrink-0 rounded-full ${STAGE_META[stage].dotClass}`} />
        {label}
      </span>
    );
  }
  return (
    <span
      data-tone={tone}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] leading-4 font-semibold ${TONE_CLASSES[tone!]}`}
    >
      {label}
    </span>
  );
}
