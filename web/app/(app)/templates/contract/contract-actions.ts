"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { canWriteTemplates, type SaveContractWordingState } from "@/app/(app)/templates/_components/state";
import { bodyFromContractForm, type ContractLayoutForm } from "@/domain/contract/layout-form";
import { bodyFromContractRichForm, isContractRichFormInput, type ContractRichForm } from "@/domain/contract/rich-form";

/**
 * Saves the editor's rows as the org's next contract wording version (block-editor AC 42, AC 43). Owners and admins only; the
 * database checks again. Invalid wording answers each row's message and keeps what was typed; nothing is written.
 */
export async function saveContractWordingAction(input: ContractLayoutForm | ContractRichForm): Promise<SaveContractWordingState> {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  if (!canWriteTemplates(member.role)) return { status: "forbidden" };

  // The Word-style editor writes schema 3, its pictures limited to the member's own org; the block editor writes schema 2.
  const checked = isContractRichFormInput(input) ? bodyFromContractRichForm(input, member.orgId) : bodyFromContractForm(input);
  if (!checked.ok) return { status: "invalid", errors: checked.errors, values: input };

  const saved = await container.saveContractWording(checked.body);
  if (!saved.ok) return { status: saved.code === "invalid" ? "unavailable" : saved.code };
  revalidatePath("/templates");
  revalidatePath("/templates/contract");
  return { status: "saved" };
}
