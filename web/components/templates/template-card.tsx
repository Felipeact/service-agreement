import Link from "next/link";
import type { AgreementTemplateSummary } from "@/application/ports";
import { Icon } from "@/components/ui/icons";
import { derivedFrequency } from "@/domain/agreement";
import { updatedAgo } from "@/lib/relative-time";
import { ArchiveControl } from "./archive-control";
import { DuplicateControl } from "./duplicate-control";
import type { ArchiveTemplateState, DuplicateTemplateState } from "./state";

export type TemplateCardActions = {
  duplicate: (templateId: string) => Promise<DuplicateTemplateState>;
  archive: (templateId: string) => Promise<ArchiveTemplateState>;
};

/** The system template has no description of its own; this says what it is. */
export const SYSTEM_DESCRIPTION = "The standard layout every agreement uses when no template is chosen.";

const ITEM = "flex min-h-11 w-full items-center px-3 text-[13px] font-medium text-ink hover:bg-ground lg:min-h-9";

type CardProps = {
  template: AgreementTemplateSummary;
  selected: boolean;
  /** Owners and admins: the card menu. */
  canWrite: boolean;
  now: Date;
  actions?: TemplateCardActions;
};

/** The three-dot menu: Edit, Duplicate and Archive. A details element, so it opens by touch and without hover. The system template can only be copied. */
function CardMenu({ template, actions }: { template: AgreementTemplateSummary; actions?: TemplateCardActions }) {
  const { id, body, system } = template;
  return (
    <details className="group relative z-10">
      <summary
        aria-label={`Actions for ${body.name}`}
        className="flex size-11 cursor-pointer list-none items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-board hover:text-ink lg:size-9 [&::-webkit-details-marker]:hidden"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="currentColor">
          <circle cx="4.5" cy="10" r="1.4" />
          <circle cx="10" cy="10" r="1.4" />
          <circle cx="15.5" cy="10" r="1.4" />
        </svg>
      </summary>
      <div className="absolute top-full right-0 mt-1 flex w-64 flex-col rounded-control border border-hairline bg-surface py-1 shadow-card">
        {!system && (
          <Link href={`/templates/${id}`} className={ITEM}>
            Edit
          </Link>
        )}
        {actions && <DuplicateControl templateId={id} action={actions.duplicate} look="item" />}
        {actions && !system && <ArchiveControl templateId={id} name={body.name} action={actions.archive} look="item" />}
      </div>
    </details>
  );
}

/** One template as a card: icon tile, menu, name, description, a divider, then the derived frequency and when it was last saved. */
export function TemplateCard({ template, selected, canWrite, now, actions }: CardProps) {
  const { id, body, system, updatedAt } = template;
  const frequency = derivedFrequency(body.preset);
  const description = body.description || (system ? SYSTEM_DESCRIPTION : "");
  return (
    <article
      data-template={id}
      className={`relative flex h-full flex-col gap-3 rounded-panel border bg-surface p-5 shadow-card transition-colors duration-150 ${selected ? "border-action ring-1 ring-action" : "border-hairline hover:border-field"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-action-tint text-action">
          <Icon name="template" className="size-5" />
        </span>
        {canWrite && <CardMenu template={template} actions={actions} />}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-[16px] leading-snug font-semibold tracking-tight">
          <Link
            href={`/templates?selected=${id}`}
            aria-current={selected ? "true" : undefined}
            className="after:absolute after:inset-0 after:rounded-panel focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            {body.name}
          </Link>
        </h3>
        <p className="line-clamp-2 min-h-[2.9em] text-[13px] text-ink-2">{description}</p>
      </div>
      <hr className="border-hairline" />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px]">
        <span className="font-semibold text-ink">{frequency ?? "No preset lines"}</span>
        <span className="text-ink-2">{updatedAgo(updatedAt, now)}</span>
      </div>
    </article>
  );
}
