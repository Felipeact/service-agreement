import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewAgreementForm } from "@/components/agreements/new-agreement-form";
import { canWriteRecords } from "@/components/records/state";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { getContainer } from "@/composition";
import { isUuid } from "@/domain/imports";
import { createAgreementAction } from "../../agreement-actions";

export const metadata: Metadata = { title: "New agreement" };

type Props = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

/**
 * The site picker that starts an agreement; members who cannot write see a forbidden panel instead (agreements-page S2).
 * `?template=<versionId>` (Use template) names that template above the site choice and pins the new agreement to it; a version
 * that is not one of the listed templates is ignored, and the agreement starts as a plain one (agreement-templates AC 24).
 */
export default async function NewAgreementPage({ searchParams }: Props = {}) {
  const { currentMember, listActiveSites, listAgreementTemplates } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  if (!canWriteRecords(member.role)) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="New agreement" />
        <EmptyPanel title="You don't have permission to create agreements." text="Ask an owner or admin to change your role." />
      </div>
    );
  }
  const asked = (await searchParams)?.template;
  const versionId = Array.isArray(asked) ? asked[0] : asked;
  const listed = versionId && isUuid(versionId) ? await listAgreementTemplates() : null;
  const found = listed?.ok ? listed.templates.find((candidate) => candidate.versionId === versionId) : undefined;
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="New agreement" />
      <NewAgreementForm
        sites={await listActiveSites()}
        create={createAgreementAction}
        template={found ? { versionId: found.versionId, name: found.body.name } : undefined}
      />
    </div>
  );
}
