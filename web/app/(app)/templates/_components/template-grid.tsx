"use client";

import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { useState, type ComponentProps } from "react";
import type { AgreementTemplateSummary } from "@/application/ports";
import { NewAgreementDialog } from "@/components/agreements/new-agreement-dialog";
import { SearchInput } from "@/components/ui/search-input";
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
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const shown = needle ? templates.filter((template) => `${template.body.name} ${template.body.description ?? ""}`.toLowerCase().includes(needle)) : templates;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-hairline bg-surface p-3 shadow-card">
        <SearchInput label="Search templates" placeholder="Search templates or clauses…" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full md:w-80" />
      </div>
      <ul aria-label="Templates" className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shown.map((template) => (
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
        {contractWording && !needle && (
          <li>
            <ContractWordingCard own={contractWording.own} canWrite={canWrite} />
          </li>
        )}
        {canWrite && !needle && (
          <li>
            <Link
              href="/templates/new"
              className="flex h-full min-h-48 flex-col items-center justify-center gap-2 rounded-panel border border-dashed border-line-strong bg-surface/60 p-6 text-center transition-colors duration-150 hover:border-action hover:bg-action-tint/40"
            >
              <span aria-hidden="true" className="inline-flex size-11 items-center justify-center rounded-full bg-action-tint text-action">
                <PlusIcon className="size-5" />
              </span>
              <span className="text-[15px] font-semibold text-ink">Create Custom Template</span>
              <span className="max-w-[30ch] text-[13px] text-ink-2">Build a tailored equipment schedule, price model, or upload existing contract PDFs to extract scope.</span>
              <span className="mt-1 inline-flex rounded-md bg-board px-3 py-1.5 text-[12px] font-semibold text-ink">+ Blank Template</span>
            </Link>
          </li>
        )}
      </ul>
      {dialog && <NewAgreementDialog {...dialog} open={open} onClose={() => setOpen(false)} initialTemplateVersionId={versionId} />}
    </>
  );
}
