import type { Metadata } from "next";
import { TemplateEditor } from "@/app/(app)/templates/_components/template-editor";
import { LogoActionsProvider } from "@/app/(app)/templates/_components/logo-actions";
import { currentLogoPath, saveLogoPath } from "@/app/logo-actions";
import { prepareLogoUpload } from "@/app/logo-upload";
import { PageHeader } from "@/components/shell/page-header";
import { EMPTY_LAYOUT_FORM } from "@/domain/agreement/template-form";
import { loadNewTemplate } from "../_data-access/templates";
import { saveAgreementTemplateAction } from "../template-actions";

export const metadata: Metadata = { title: "New template" };

/** The empty editor for an owner or admin; an estimator or viewer goes back to the list (agreement-templates AC 21). */
export default async function NewTemplatePage() {
  const { orgName, types } = await loadNewTemplate();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="New template" subtitle="Wording, sections and the lines a new agreement starts with." />
      <LogoActionsProvider actions={{ current: currentLogoPath, save: saveLogoPath, prepare: prepareLogoUpload }}>
      <TemplateEditor templateId={null} initial={EMPTY_LAYOUT_FORM} types={types.map(({ code, name }) => ({ code, name }))} save={saveAgreementTemplateAction} orgName={orgName} />
      </LogoActionsProvider>
    </div>
  );
}
