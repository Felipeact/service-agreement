import type { Metadata } from "next";
import { Suspense } from "react";
import { ContractView } from "./_components/content";
import { PageLoading } from "@/components/shell/page-loading";
import { sendForSignatureAction } from "../../signing-actions";
import { loadContract } from "./_data-access/contract";

export const metadata: Metadata = { title: "Contract" };

/** Reads the contract, then the agreement at the contract's own version, at request time. */
export async function ContractForRequest({ contractId }: { contractId: string }) {
  const { role, email, contract, agreement, request, customerLinkUrl, contractorSrc } = await loadContract(contractId);
  return (
    <ContractView
      contract={contract}
      agreement={agreement}
      signing={{
        contractStatus: contract.status,
        request,
        role,
        customer: contract.parties?.signer ?? null,
        memberEmail: email,
        customerLinkUrl,
        contractorSrc,
        send: sendForSignatureAction.bind(null, contract.id),
        contractId: contract.id,
        signed: contract.signed ?? null,
      }}
    />
  );
}

export default async function ContractPage({ params }: PageProps<"/contracts/[contractId]">) {
  const { contractId } = await params;
  return (
    <Suspense fallback={<PageLoading title="Contract" />}>
      <ContractForRequest contractId={contractId} />
    </Suspense>
  );
}
