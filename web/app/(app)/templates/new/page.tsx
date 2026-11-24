import type { Metadata } from "next";
import { TemplateEditor } from "@/app/(app)/templates/_components/template-editor";
import { LogoActionsProvider } from "@/app/(app)/templates/_components/logo-actions";
import { currentLogoPath, saveLogoPath } from "@/app/logo-actions";
import { prepareLogoUpload } from "@/app/logo-upload";
import { PageHeader } from "@/components/shell/page-header";
import { EMPTY_RICH_FORM } from "@/domain/agreement/rich-form";
import { loadNewTemplate } from "../_data-access/templates";
import { saveAgreementTemplateAction } from "../template-actions";

export const metadata: Metadata = { title: "New template" };

/** The empty editor for an owner or admin; an estimator or viewer goes back to the list (agreement-templates AC 21). */
export default async function NewTemplatePage() {
  const { types, env } = await loadNewTemplate();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="New template" subtitle="A blank page: design it as you like, with your fields, price lines and visit schedule where you want them." />
      <LogoActionsProvider actions={{ current: currentLogoPath, save: saveLogoPath, prepare: prepareLogoUpload }}>
      <TemplateEditor templateId={null} initial={EMPTY_RICH_FORM} types={types.map(({ code, name }) => ({ code, name }))} save={saveAgreementTemplateAction} env={env} />
      </LogoActionsProvider>
    </div>
  );
}
