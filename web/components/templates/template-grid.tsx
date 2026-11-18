"use client";

import { useState, type ComponentProps } from "react";
import type { AgreementTemplateSummary } from "@/application/ports";
import { NewAgreementDialog } from "@/components/agreements/new-agreement-dialog";
import { ContractWordingCard } from "./contract-wording-card";
import { TemplateCard, type TemplateCardActions } from "./template-card";

/** What the dialog needs beyond the open state: the same customers, sites, templates and actions the launcher passes. */
export type UseDialogProps = Pick<ComponentProps<typeof NewAgreementDialog>, "customers" | "sites" | "templates" | "actions" | "equipmentTypes">;

type Props = {
  templates: AgreementTemplateSummary[];
  canWrite: boolean;
  canUse: boolean;
  now: Date;
  actions?: TemplateCardActions;
  /** Absent for a member who cannot start agreements: the cards then have no Use template to press. */
  dialog?: UseDialogProps;
  /** Whether the org has its own contract wording; absent when it could not be read, and then no card is drawn. */
  contractWording?: { own: boolean };
};

/**
 * The cards in one grid, the contract wording among them (template-editor-v2 S6). Use template opens the New agreement dialog over this
 * page with that template chosen, so the page does not navigate; closing it leaves the page as it was.
 */
export function TemplateGrid({ templates, canWrite, canUse, now, actions, dialog, contractWording }: Props) {
  const [open, setOpen] = useState(false);
  const [versionId, setVersionId] = useState<string | undefined>();
  return (
    <>
      <ul aria-label="Templates" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
          <li key={template.id}>
            <TemplateCard
              template={template}
              canWrite={canWrite}
              canUse={canUse}
              now={now}
              actions={actions}
              onUse={(chosen) => {
                setVersionId(chosen);
                setOpen(true);
              }}
            />
          </li>
        ))}
        {contractWording && (
          <li>
            <ContractWordingCard own={contractWording.own} canWrite={canWrite} />
          </li>
        )}
      </ul>
      {dialog && <NewAgreementDialog {...dialog} open={open} onClose={() => setOpen(false)} initialTemplateVersionId={versionId} />}
    </>
  );
}
