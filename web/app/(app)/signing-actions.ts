"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { SendSignatureState } from "@/components/contracts/signing-state";
import { getContainer } from "@/composition";
import { canSignContracts } from "@/domain/contract";
import { isUuid } from "@/domain/imports";
import { linkBase } from "./link-base";

/**
 * Sends the contract for signature as the member (signature-provider S2). The org and the contractor's email come from
 * the member, the signer for the customer from the contract's frozen parties, never from the request. The page re-reads the
 * request afterwards, so the link is not returned here.
 */
export async function sendForSignatureAction(contractId: string, name: string): Promise<SendSignatureState> {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  if (!canSignContracts(member.role)) return { status: "forbidden" };
  if (!isUuid(contractId)) return { status: "not_found" };
  try {
    const sent = await container.sendForSignature({
      contractId,
      orgId: member.orgId,
      contractorName: name.trim(),
      contractorEmail: member.email,
      baseUrl: await linkBase(),
    });
    if (!sent.ok) return { status: sent.code };
    revalidatePath(`/contracts/${contractId}`);
    return { status: "sent" };
  } catch (cause) {
    console.error(`Sending contract ${contractId} for signature failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    return { status: "unavailable" };
  }
}
