import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canWriteTemplates } from "@/components/templates/state";
import { TemplateEditor } from "@/components/templates/template-editor";
import { PageHeader } from "@/components/shell/page-header";
import { getContainer } from "@/composition";
import { EMPTY_LAYOUT_FORM } from "@/domain/agreement/template-form";
import { saveAgreementTemplateAction } from "../template-actions";

export const metadata: Metadata = { title: "New template" };

/** The empty editor for an owner or admin; an estimator or viewer goes back to the list (agreement-templates AC 21). */
export default async function NewTemplatePage() {
  const { currentMember, listAssetTypes } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  if (!canWriteTemplates(member.role)) redirect("/templates");
  const types = await listAssetTypes();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="New template" subtitle="Wording, sections and the lines a new agreement starts with." />
      <TemplateEditor templateId={null} initial={EMPTY_LAYOUT_FORM} types={types.map(({ code, name }) => ({ code, name }))} save={saveAgreementTemplateAction} />
    </div>
  );
}
