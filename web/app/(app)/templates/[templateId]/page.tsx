import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { canWriteTemplates } from "@/components/templates/state";
import { TemplateEditor } from "@/components/templates/template-editor";
import { PageHeader } from "@/components/shell/page-header";
import { getContainer } from "@/composition";
import { templateFormFromBody } from "@/domain/agreement/template-form";
import { isUuid } from "@/domain/imports";
import { saveAgreementTemplateAction } from "../template-actions";

export const metadata: Metadata = { title: "Edit template" };

/**
 * The editor with the template's latest version, for an owner or admin. Saving writes the next version. A malformed id, an unknown
 * one, another org's, an archived one and the system template (which no member edits) are 404 (agreement-templates AC 21, Surface).
 */
export async function EditTemplateForRequest({ templateId }: { templateId: string }) {
  const { currentMember, listAgreementTemplates, listAssetTypes } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  if (!canWriteTemplates(member.role)) redirect("/templates");
  if (!isUuid(templateId)) notFound();

  const [list, types] = await Promise.all([listAgreementTemplates(), listAssetTypes()]);
  if (!list.ok) throw new Error("The template list could not be read");
  const template = list.templates.find((candidate) => candidate.id === templateId && !candidate.system);
  if (!template) notFound();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Edit template" subtitle={`Saving writes version ${template.versionNo + 1}. Agreements already sent keep the version they used.`} />
      <TemplateEditor
        templateId={template.id}
        initial={templateFormFromBody(template.body)}
        types={types.map(({ code, name }) => ({ code, name }))}
        save={saveAgreementTemplateAction}
      />
    </div>
  );
}

export default async function EditTemplatePage({ params }: PageProps<"/templates/[templateId]">) {
  const { templateId } = await params;
  return <EditTemplateForRequest templateId={templateId} />;
}
