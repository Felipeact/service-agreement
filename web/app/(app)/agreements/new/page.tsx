import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { NewAgreementForm } from "@/components/agreements/new-agreement-form";
import { canWriteRecords } from "@/components/records/state";
import { PageHeader } from "@/components/shell/page-header";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { getContainer } from "@/composition";
import { createAgreementAction } from "../../agreement-actions";

export const metadata: Metadata = { title: "New agreement" };

/** The site picker that starts an agreement; members who cannot write see a forbidden panel instead (agreements-page S2). */
export default async function NewAgreementPage() {
  const { currentMember, listActiveSites } = await getContainer();
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
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="New agreement" />
      <NewAgreementForm sites={await listActiveSites()} create={createAgreementAction} />
    </div>
  );
}
