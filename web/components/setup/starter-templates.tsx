"use client";

import Link from "next/link";
import { useMemo } from "react";
import { TemplatePreviewFrame } from "@/components/templates/template-preview-frame";
import { SYSTEM_AGREEMENT_BODY } from "@/domain/agreement";
import { templateFormFromBody } from "@/domain/agreement/template-form";
import { buildStarterContractPreview } from "@/domain/contract/starter-preview";
import type { OrgSettingsValue } from "@/domain/org-settings";

export const STARTER_COPY = {
  title: "Your starter templates",
  saved: "Shown with the details you have saved so far.",
  contractNote: "Sample wording, not a signed contract",
  customize: "Customize in Templates",
} as const;

/** The same tap area the screen's other inline links use. */
const LINK = "inline-block py-3.5 -my-3.5 text-[13px] font-semibold text-action hover:underline lg:py-0 lg:my-0";

/** One stable value: the preview frame requests again whenever its `values` change. */
const SYSTEM_FORM = templateFormFromBody(SYSTEM_AGREEMENT_BODY);

/**
 * The two starter templates as a new owner will meet them: the system agreement drawn as the customer's PDF, and the system
 * contract wording as text (setup-template-preview). Read only. It shows the org's saved settings, never the form's unsaved values.
 */
export function StarterTemplates({ settings }: { settings: OrgSettingsValue }) {
  const blocks = useMemo(() => buildStarterContractPreview(settings), [settings]);
  return (
    <section aria-labelledby="starter-title" className="flex flex-col gap-4 rounded-panel border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id="starter-title" className="font-display text-[18px] font-semibold tracking-tight">
          {STARTER_COPY.title}
        </h2>
        <p className="text-[13px] text-ink-2">{STARTER_COPY.saved}</p>
      </div>
      <div className="grid grid-cols-1 gap-6">
        <div className="flex min-w-0 flex-col gap-2" data-half="agreement">
          <h3 className="text-[14px] font-semibold">Agreement</h3>
          <TemplatePreviewFrame values={SYSTEM_FORM} />
          <Link href="/templates" className={LINK}>
            {STARTER_COPY.customize}
          </Link>
        </div>
        <div className="flex min-w-0 flex-col gap-2" data-half="contract">
          <h3 className="text-[14px] font-semibold">Contract</h3>
          <p className="text-[13px] text-ink-2">{STARTER_COPY.contractNote}</p>
          <div className="flex flex-col gap-2 rounded-control border border-hairline bg-ground p-4 text-[13px]">
            {blocks.map((block, index) =>
              block.type === "heading" ? (
                <h4 key={index} className="text-[13px] font-semibold">
                  {block.text}
                </h4>
              ) : (
                <p key={index}>{block.text}</p>
              ),
            )}
          </div>
          <Link href="/templates" className={LINK}>
            {STARTER_COPY.customize}
          </Link>
        </div>
      </div>
    </section>
  );
}
