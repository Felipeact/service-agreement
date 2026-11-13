import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { canWriteTemplates } from "@/components/templates/state";
import { ContractWordingEditor } from "@/components/templates/contract-wording-editor";
import { PageHeader } from "@/components/shell/page-header";
import { getContainer } from "@/composition";
import { contractFormFromBody } from "@/domain/contract/layout-form";
import { saveContractWordingAction } from "./contract-actions";

export const metadata: Metadata = { title: "Contract wording" };

/**
 * The block editor on the org's own contract wording, or on the system wording while it has none, with the contract PDF beside it.
 * Owners and admins only: an estimator or viewer goes back to the templates, a signed-out visitor to sign in (block-editor AC 41, AC 47).
 */
export default async function ContractWordingPage() {
  const { currentMember, getContractWording } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  if (!canWriteTemplates(member.role)) redirect("/templates");

  const wording = await getContractWording();
  if (!wording.ok) throw new Error("The contract wording could not be read");
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Contract wording"
        subtitle={wording.own ? "Saving writes a new version. Contracts already made keep the wording they were made with." : "This is the standard wording. Saving makes it your own; contracts already made keep theirs."}
      />
      <ContractWordingEditor initial={contractFormFromBody(wording.body)} save={saveContractWordingAction} />
    </div>
  );
}
