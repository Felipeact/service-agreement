import type { Metadata } from "next";
import { ContractWordingEditor } from "@/app/(app)/templates/_components/contract-wording-editor";
import { LogoActionsProvider } from "@/app/(app)/templates/_components/logo-actions";
import { currentLogoPath, saveLogoPath } from "@/app/logo-actions";
import { prepareLogoUpload } from "@/app/logo-upload";
import { PageHeader } from "@/components/shell/page-header";
import { contractFormFromBody } from "@/domain/contract/layout-form";
import { loadContractWording } from "../_data-access/templates";
import { saveContractWordingAction } from "./contract-actions";
import { importContractWordingAction } from "./import-actions";

export const metadata: Metadata = { title: "Contract wording" };

/**
 * The block editor on the org's own contract wording, or on the system wording while it has none, with the contract PDF beside it.
 * Owners and admins only: an estimator or viewer goes back to the templates, a signed-out visitor to sign in (block-editor AC 41, AC 47).
 */
export default async function ContractWordingPage() {
  const { orgName, wording } = await loadContractWording();
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Contract wording"
        subtitle={wording.own ? "Saving writes a new version. Contracts already made keep the wording they were made with." : "This is the standard wording. Saving makes it your own; contracts already made keep theirs."}
      />
      <LogoActionsProvider actions={{ current: currentLogoPath, save: saveLogoPath, prepare: prepareLogoUpload }}>
      <ContractWordingEditor initial={contractFormFromBody(wording.body)} save={saveContractWordingAction} importAction={importContractWordingAction} orgName={orgName} />
      </LogoActionsProvider>
    </div>
  );
}
