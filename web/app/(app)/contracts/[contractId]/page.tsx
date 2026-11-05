import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ContractView } from "@/components/contracts/contract-view";
import { PageLoading } from "@/components/shell/page-loading";
import { getContainer } from "@/composition";
import { isUuid } from "@/domain/imports";

export const metadata: Metadata = { title: "Contract" };

/** Reads the contract, then the agreement at the contract's own version, at request time. */
export async function ContractForRequest({ contractId }: { contractId: string }) {
  if (!isUuid(contractId)) notFound();
  const { currentMember, contractReader, agreementReader } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const contract = await contractReader.get(contractId);
  if (!contract) notFound();
  const agreement = await agreementReader.get(contract.agreementId, contract.versionNo);
  if (!agreement) notFound();
  return <ContractView contract={contract} agreement={agreement} />;
}

export default async function ContractPage({ params }: PageProps<"/contracts/[contractId]">) {
  const { contractId } = await params;
  return (
    <Suspense fallback={<PageLoading title="Contract" />}>
      <ContractForRequest contractId={contractId} />
    </Suspense>
  );
}
