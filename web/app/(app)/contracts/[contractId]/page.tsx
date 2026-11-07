import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ContractView } from "@/components/contracts/contract-view";
import { PageLoading } from "@/components/shell/page-loading";
import { getContainer } from "@/composition";
import { canSignContracts, signingLinkUrl } from "@/domain/contract";
import { isUuid } from "@/domain/imports";
import { linkBase } from "../../link-base";
import { sendForSignatureAction } from "../../signing-actions";

export const metadata: Metadata = { title: "Contract" };

/** Reads the contract, then the agreement at the contract's own version, at request time. */
export async function ContractForRequest({ contractId }: { contractId: string }) {
  if (!isUuid(contractId)) notFound();
  const { currentMember, contractReader, agreementReader, signingSecrets, signingTokens } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const contract = await contractReader.get(contractId);
  if (!contract) notFound();
  const agreement = await agreementReader.get(contract.agreementId, contract.versionNo);
  if (!agreement) notFound();
  const request = contract.signing ?? null;
  let customerLinkUrl: string | null = null;
  let contractorSrc: string | null = null;
  // The sealed values are read only for an owner or admin and only when a request is open: nobody else may use them, and a
  // read that cannot be shown is a call wasted (signature-provider AC 11, AC 26, AC 29).
  if (canSignContracts(member.role) && request?.status === "open") {
    const link = await signingSecrets.customerLink(contract.id);
    if (link.ok) {
      const base = await linkBase();
      customerLinkUrl = unsealed(() => signingLinkUrl(base, signingTokens.unseal(link.sealed)));
    }
    if (contract.status === "client_signed") {
      const source = await signingSecrets.contractorSource(contract.id);
      if (source.ok) contractorSrc = unsealed(() => signingTokens.unseal(source.sealed));
    }
  }
  return (
    <ContractView
      contract={contract}
      agreement={agreement}
      signing={{
        contractStatus: contract.status,
        request,
        role: member.role,
        customer: contract.parties?.signer ?? null,
        memberEmail: member.email,
        customerLinkUrl,
        contractorSrc,
        send: sendForSignatureAction.bind(null, contract.id),
      }}
    />
  );
}

/** A sealed value that cannot be opened (a changed key) is shown as missing, never as a crash. */
function unsealed(open: () => string): string | null {
  try {
    return open();
  } catch (cause) {
    console.error(`Opening a signing value failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    return null;
  }
}

export default async function ContractPage({ params }: PageProps<"/contracts/[contractId]">) {
  const { contractId } = await params;
  return (
    <Suspense fallback={<PageLoading title="Contract" />}>
      <ContractForRequest contractId={contractId} />
    </Suspense>
  );
}
