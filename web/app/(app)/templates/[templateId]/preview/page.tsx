import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { isUuid } from "@/domain/imports";
import { SavedPreview } from "../../_components/saved-preview";
import { loadTemplatePreview } from "../../_data-access/templates";

export const metadata: Metadata = { title: "Template preview" };

/**
 * The preview page of an agreement template's saved version (rich-templates), for any member: the real PDF on sample data or on one
 * of the org's agreements (`?agreement=<id>`). Owners and admins get an Edit button.
 */
export default async function TemplatePreviewPage({ params, searchParams }: PageProps<"/templates/[templateId]/preview">) {
  const { templateId } = await params;
  const { agreement } = await searchParams;
  const agreementId = typeof agreement === "string" && isUuid(agreement) ? agreement : null;
  const { template, canEdit, agreements } = await loadTemplatePreview(templateId);
  return (
    <div className="flex flex-col gap-4">
      <Link href="/templates" className="inline-flex min-h-11 w-fit items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink lg:min-h-0">
        <span aria-hidden="true">←</span> Templates
      </Link>
      <PageHeader title={template.body.name} subtitle={`Version ${template.versionNo}, as the customer receives it.`} />
      <SavedPreview
        pdfPath={`/templates/${template.id}/preview/pdf`}
        agreements={agreements}
        agreementId={agreementId}
        editHref={canEdit ? `/templates/${template.id}` : null}
        frameTitle="Agreement template PDF"
        note="Marked TEMPLATE PREVIEW on every page. Nothing is saved or sent from here."
      />
    </div>
  );
}
