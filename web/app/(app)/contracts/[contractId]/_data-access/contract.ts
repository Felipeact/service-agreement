import { notFound, redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { canSignContracts, signingLinkUrl } from "@/domain/contract";
import { isUuid } from "@/domain/imports";
import { linkBase } from "../../../link-base";

/** A sealed value that cannot be opened (a changed key) is shown as missing, never as a crash. */
function unsealed(open: () => string): string | null {
  try {
    return open();
  } catch (cause) {
    console.error(`Opening a signing value failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    return null;
  }
}

/**
 * What the contract page reads: the contract, the agreement at the contract's own version and, while a signature request is
 * open, the sealed signing values for an owner or admin. Signed out goes to /login; a malformed or foreign id is a 404.
 */
export async function loadContract(contractId: string) {
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
  return { role: member.role, email: member.email, contract, agreement, request, customerLinkUrl, contractorSrc };
}
