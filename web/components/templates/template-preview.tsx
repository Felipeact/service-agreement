import type { AgreementTemplateSummary } from "@/application/ports";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { LinkButton } from "@/components/ui/link-button";
import { derivedFrequency, previewSummary } from "@/domain/agreement";
import { DEFAULT_ITEM_WORDS, itemText, type ItemWords } from "@/domain/org-settings";
import { CustomizeControl } from "./customize-control";
import { DuplicateControl } from "./duplicate-control";
import { SYSTEM_DESCRIPTION, type TemplateCardActions } from "./template-card";

type PreviewProps = {
  template: AgreementTemplateSummary;
  /** The org's own name for each equipment type code. */
  typeNames: Record<string, string>;
  /** Owner, admin and estimator start agreements from a template. */
  canUse: boolean;
  /** Owner and admin copy a template. */
  canWrite: boolean;
  actions?: Pick<TemplateCardActions, "duplicate" | "customize">;
  /** The org's item words; the default when absent. */
  words?: ItemWords;
  /** Called with the template's latest version id when Use template is pressed; the page opens the New agreement dialog with it. */
  onUse?: (versionId: string) => void;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 text-[13px]">
      <dt className="text-ink-2">{label}</dt>
      <dd className="text-right font-semibold text-ink">{value}</dd>
    </div>
  );
}

/** The selected template's preview: what it presets, then Use template and Duplicate (agreement-templates AC 16). */
export function TemplatePreview({ template, typeNames, canUse, canWrite, actions, words = DEFAULT_ITEM_WORDS, onUse }: PreviewProps) {
  const { body, system, versionId, id } = template;
  const summary = previewSummary(body, typeNames);
  return (
    <aside id="template-preview" aria-label="Template preview" className="flex flex-col gap-4 rounded-panel border border-hairline bg-surface p-5 shadow-card xl:sticky xl:top-4">
      <p className="text-[11px] leading-4 font-semibold tracking-wider text-ink-2 uppercase">Template preview</p>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-[20px] leading-tight font-semibold tracking-tight">{body.name}</h2>
        <p className="text-[13px] text-ink-2">{body.description || (system ? SYSTEM_DESCRIPTION : "")}</p>
      </div>
      <dl className="flex flex-col divide-y divide-hairline rounded-control bg-ground px-4 py-1.5">
        <Row label="Default frequency" value={derivedFrequency(body.preset) ?? "Not set"} />
        <Row label={itemText("Equipment types", words)} value={summary.equipmentTypes.length > 0 ? summary.equipmentTypes.join(", ") : "None"} />
        <Row label="Sections" value={`${summary.sections} · ${summary.clauses}`} />
        <Row label="Preset lines" value={summary.preset} />
      </dl>
      {(canUse || canWrite) && (
        <div className="flex flex-col gap-2">
          {canUse && (
            <Button variant="primary" className="w-full" onClick={() => onUse?.(versionId)}>
              <Icon name="document" className="size-4" />
              Use template
            </Button>
          )}
          {/* The system template is customised into the org's own; an org's own template is edited. */}
          {canWrite && !system && (
            <LinkButton href={`/templates/${id}`} className="w-full">
              Edit
            </LinkButton>
          )}
          {canWrite && system && actions?.customize && <CustomizeControl templateId={id} action={actions.customize} />}
          {canWrite && actions && <DuplicateControl templateId={id} action={actions.duplicate} />}
        </div>
      )}
    </aside>
  );
}
