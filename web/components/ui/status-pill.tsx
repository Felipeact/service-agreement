import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { STAGE_META, type PipelineStage } from "@/lib/pipeline-stage";

type StatusPillProps = {
  /** Always required: colour never carries meaning alone. */
  label: string;
} & (
  | { stage: PipelineStage; tone?: never; /** A tinted pill, as on a card, instead of a dot beside the label. */ filled?: boolean }
  | { tone: "attention" | "neutral"; stage?: never; filled?: never }
);

/** The attention pill keeps a faint ring of its own text colour so it still reads on an amber column well. */
const TONE_CLASSES = {
  attention: "bg-attention-bg text-attention-fg ring-1 ring-inset ring-attention-fg/15",
  neutral: "bg-board text-ink-2",
};

/** A stage renders as a coloured dot beside its label, or as a tinted pill when `filled`; a tone renders as a tinted pill. */
export function StatusPill({ label, stage, tone, filled }: StatusPillProps) {
  if (stage && filled) {
    return (
      <Badge data-stage-pill={stage} title={STAGE_META[stage].label} className={cn("h-[22px] rounded-full px-2.5 text-[11px] leading-4 font-semibold", STAGE_META[stage].pillClass)}>
        {label}
      </Badge>
    );
  }
  if (stage) {
    return (
      <span className="inline-flex items-center gap-2 font-semibold text-ink" title={STAGE_META[stage].label}>
        <span data-stage-dot={stage} aria-hidden="true" className={`size-2 shrink-0 rounded-full ${STAGE_META[stage].dotClass}`} />
        {label}
      </span>
    );
  }
  return (
    <Badge data-tone={tone} className={cn("h-auto rounded-full px-2 py-0.5 text-[11px] leading-4 font-semibold", TONE_CLASSES[tone!])}>
      {label}
    </Badge>
  );
}
