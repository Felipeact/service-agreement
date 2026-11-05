"use server";

import { redirect } from "next/navigation";
import type { GenerateContractState } from "@/components/agreements/contract-state";
import { canWriteRecords } from "@/components/records/state";
import { getContainer } from "@/composition";
import { isUuid } from "@/domain/imports";

/**
 * Generates the contract of an accepted agreement as the member and opens it. The org comes from the member and the
 * version from the agreement, never from the request (contract-generation door 2).
 */
export async function generateContractAction(agreementId: string): Promise<GenerateContractState> {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  if (!canWriteRecords(member.role)) return { status: "forbidden" };
  if (!isUuid(agreementId)) return { status: "not_found" };
  const created = await container.contractStore.create(agreementId);
  if (created.ok) redirect(`/contracts/${created.id}`);
  return { status: created.code };
}
