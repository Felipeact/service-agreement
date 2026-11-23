"use client";

import { useState, type ComponentProps } from "react";
import type { AgreementTemplateSummary } from "@/application/ports";
import { NewAgreementDialog } from "@/components/agreements/new-agreement-dialog";
import { ContractWordingCard } from "./contract-wording-card";
import { TemplateCard, type TemplateCardActions } from "./template-card";

/** What the dialog needs beyond the open state: the same customers, sites, templates and actions the launcher passes. */
export type UseDialogProps = Pick<ComponentProps<typeof NewAgreementDialog>, "customers" | "sites" | "templates" | "actions">;

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
  const [kind, setKind] = useState<"agreement" | "contract">("agreement");
  const tabs = [
    { key: "agreement" as const, label: "Agreement" },
    ...(contractWording ? [{ key: "contract" as const, label: "Contract wording" }] : []),
  ];
  return (
    <>
      <div role="tablist" aria-label="Template kind" className="relative -mx-1 mb-4 flex gap-1 overflow-x-auto px-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={kind === tab.key}
            onClick={() => setKind(tab.key)}
            className={`inline-flex h-11 shrink-0 items-center rounded-control px-3 text-[13px] font-semibold transition-colors lg:h-9 ${kind === tab.key ? "bg-action-tint text-action-press" : "text-ink-nav hover:bg-board hover:text-ink"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <ul aria-label="Templates" className="stagger grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => (
            <li key={template.id} className={kind === "agreement" ? undefined : "hidden"}>
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
          <li className={kind === "contract" ? undefined : "hidden"}>
            <ContractWordingCard own={contractWording.own} canWrite={canWrite} />
          </li>
        )}
      </ul>
      {dialog && <NewAgreementDialog {...dialog} open={open} onClose={() => setOpen(false)} initialTemplateVersionId={versionId} />}
    </>
  );
}
