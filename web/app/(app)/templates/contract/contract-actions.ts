"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { canWriteTemplates, type SaveContractWordingState } from "@/components/templates/state";
import { bodyFromContractForm, type ContractLayoutForm } from "@/domain/contract/layout-form";

/**
 * Saves the editor's rows as the org's next contract wording version (block-editor AC 42, AC 43). Owners and admins only; the
 * database checks again. Invalid wording answers each row's message and keeps what was typed; nothing is written.
 */
export async function saveContractWordingAction(input: ContractLayoutForm): Promise<SaveContractWordingState> {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  if (!canWriteTemplates(member.role)) return { status: "forbidden" };

  const checked = bodyFromContractForm(input);
  if (!checked.ok) return { status: "invalid", errors: checked.errors, values: input };

  const saved = await container.saveContractWording(checked.body);
  if (!saved.ok) return { status: saved.code === "invalid" ? "unavailable" : saved.code };
  revalidatePath("/templates");
  revalidatePath("/templates/contract");
  return { status: "saved" };
}
