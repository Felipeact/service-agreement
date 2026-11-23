import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { isUuid } from "@/domain/imports";
import { SavedPreview } from "../../_components/saved-preview";
import { loadContractPreview } from "../../_data-access/templates";

export const metadata: Metadata = { title: "Contract wording preview" };

/** The preview page of the saved contract wording (rich-templates), for any member; owners and admins get an Edit button. */
export default async function ContractPreviewPage({ searchParams }: PageProps<"/templates/contract/preview">) {
  const { agreement } = await searchParams;
  const agreementId = typeof agreement === "string" && isUuid(agreement) ? agreement : null;
  const { wording, canEdit, agreements } = await loadContractPreview();
  return (
    <div className="flex flex-col gap-4">
      <Link href="/templates" className="inline-flex min-h-11 w-fit items-center gap-1 text-[13px] font-medium text-ink-2 hover:text-ink lg:min-h-0">
        <span aria-hidden="true">←</span> Templates
      </Link>
      <PageHeader title="Contract wording" subtitle={wording.own ? "Your saved wording, as the customer signs it." : "The standard wording, as the customer signs it."} />
      <SavedPreview
        pdfPath="/templates/contract/preview/pdf"
        agreements={agreements}
        agreementId={agreementId}
        editHref={canEdit ? "/templates/contract" : null}
        frameTitle="Contract PDF"
        note="Drawn on sample data or the agreement you choose. Nothing is saved or sent from here."
      />
    </div>
  );
}
