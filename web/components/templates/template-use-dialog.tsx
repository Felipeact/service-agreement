"use client";

import { useState, type ComponentProps } from "react";
import { NewAgreementDialog } from "@/components/agreements/new-agreement-dialog";
import { TemplatePreview } from "./template-preview";

/** What the dialog needs beyond the open state: the same customers, sites, templates and actions the launcher passes. */
export type UseDialogProps = Pick<ComponentProps<typeof NewAgreementDialog>, "customers" | "sites" | "templates" | "actions">;

type Props = {
  preview: Omit<ComponentProps<typeof TemplatePreview>, "onUse">;
  /** Absent for a member who cannot start agreements: the preview then has no Use template to press. */
  dialog?: UseDialogProps;
};

/**
 * The preview with the New agreement dialog mounted beside it. Use template opens the dialog over the Templates page with that
 * template chosen, so the page does not navigate; closing it leaves the page, and the selected card, as they were.
 */
export function TemplateUseDialog({ preview, dialog }: Props) {
  const [open, setOpen] = useState(false);
  const [versionId, setVersionId] = useState<string | undefined>();
  return (
    <>
      <TemplatePreview
        {...preview}
        onUse={(chosen) => {
          setVersionId(chosen);
          setOpen(true);
        }}
      />
      {dialog && <NewAgreementDialog {...dialog} open={open} onClose={() => setOpen(false)} initialTemplateVersionId={versionId} />}
    </>
  );
}
