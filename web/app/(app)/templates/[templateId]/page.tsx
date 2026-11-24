import type { Metadata } from "next";
import { TemplateEditor } from "@/app/(app)/templates/_components/template-editor";
import { LogoActionsProvider } from "@/app/(app)/templates/_components/logo-actions";
import { currentLogoPath, saveLogoPath } from "@/app/logo-actions";
import { prepareLogoUpload } from "@/app/logo-upload";
import { PageHeader } from "@/components/shell/page-header";
import { richFormFromBody } from "@/domain/agreement/rich-form";
import { loadTemplateToEdit } from "../_data-access/templates";
import { saveAgreementTemplateAction } from "../template-actions";

export const metadata: Metadata = { title: "Edit template" };

/**
 * The editor with the template's latest version, for an owner or admin. Saving writes the next version. A malformed id, an unknown
 * one, another org's, an archived one and the system template (which no member edits) are 404 (agreement-templates AC 21, Surface).
 */
export async function EditTemplateForRequest({ templateId }: { templateId: string }) {
  const { template, types, env } = await loadTemplateToEdit(templateId);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Edit template" subtitle={`Saving writes version ${template.versionNo + 1}. Agreements already sent keep the version they used.`} />
      <LogoActionsProvider actions={{ current: currentLogoPath, save: saveLogoPath, prepare: prepareLogoUpload }}>
      <TemplateEditor
        templateId={template.id}
        initial={richFormFromBody(template.body)}
        types={types.map(({ code, name }) => ({ code, name }))}
        save={saveAgreementTemplateAction}
        env={env}
        converted={template.body.schema !== 3}
      />
      </LogoActionsProvider>
    </div>
  );
}

export default async function EditTemplatePage({ params }: PageProps<"/templates/[templateId]">) {
  const { templateId } = await params;
  return <EditTemplateForRequest templateId={templateId} />;
}
