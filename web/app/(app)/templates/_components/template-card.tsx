import type { AgreementTemplateSummary } from "@/application/ports";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { derivedFrequency } from "@/domain/agreement";
import { updatedAgo } from "@/lib/relative-time";
import { ArchiveControl } from "./archive-control";
import { TemplateThumb } from "./template-thumb";
import { CustomizeControl } from "./customize-control";
import { DuplicateControl } from "./duplicate-control";
import type { ArchiveTemplateState, CustomizeTemplateState, DuplicateTemplateState } from "./state";

export type TemplateCardActions = {
  duplicate: (templateId: string) => Promise<DuplicateTemplateState>;
  archive: (templateId: string) => Promise<ArchiveTemplateState>;
  /** Saves the system template as the org's own (template-flow AC 14). */
  customize?: (templateId: string) => Promise<CustomizeTemplateState>;
};

/** The system template has no description of its own; this says what it is. */
export const SYSTEM_DESCRIPTION = "The standard layout every agreement uses when no template is chosen.";

type CardProps = {
  template: AgreementTemplateSummary;
  /** Owners and admins: the card menu and the link into the editor. */
  canWrite: boolean;
  /** Owner, admin and estimator start agreements from a template. */
  canUse: boolean;
  now: Date;
  actions?: TemplateCardActions;
  /** Called with the template's latest version id when Use template is pressed. */
  onUse?: (versionId: string) => void;
};

/** One template as a card: icon tile, menu, name, description, a divider, the derived frequency and when it was last saved, and Use template. */
export function TemplateCard({ template, canWrite, canUse, now, actions, onUse }: CardProps) {
  const { id, body, system, updatedAt, versionId } = template;
  const frequency = derivedFrequency(body.preset);
  const description = body.description || (system ? SYSTEM_DESCRIPTION : "");
  const small = "h-11 lg:h-8";
  return (
    <article data-template={id} className="flex h-full flex-col gap-4 rounded-panel border border-hairline bg-surface p-5 shadow-card">
      <TemplateThumb body={body} />
      <div>
        <div className="flex items-center gap-2">
          <h3 className="mr-auto text-[15px] leading-snug font-semibold">{body.name}</h3>
          <span className="inline-flex h-[22px] items-center rounded-full bg-action-tint px-2.5 text-[11px] font-semibold whitespace-nowrap text-action-press">Agreement</span>
        </div>
        {description && <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-2">{description}</p>}
        <p className="text-[12px] text-ink-2">
          {frequency ?? "No preset lines"} · {updatedAgo(updatedAt, now)}
        </p>
      </div>
      <div className="mt-auto flex flex-wrap items-start gap-2">
        {canUse && (
          <Button variant="primary" className={small} onClick={() => onUse?.(versionId)}>
            Use template
          </Button>
        )}
        <LinkButton href={`/templates/${id}/preview`} variant="secondary" aria-label={`Preview ${body.name}`} className={small}>
          Preview
        </LinkButton>
        {canWrite && !system && (
          <LinkButton href={`/templates/${id}`} variant="secondary" aria-label={`Edit ${body.name}`} className={small}>
            Edit
          </LinkButton>
        )}
        {canWrite && actions?.customize && system && <CustomizeControl templateId={id} action={actions.customize} />}
        {canWrite && actions && <DuplicateControl templateId={id} action={actions.duplicate} look="button" className={small} />}
        {canWrite && actions && !system && <ArchiveControl templateId={id} name={body.name} action={actions.archive} look="button" className={small} />}
      </div>
    </article>
  );
}
