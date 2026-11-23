"use server";

import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import type { ImportContractWordingState } from "@/app/(app)/templates/_components/state";

/**
 * Reads the attached contract into the editor's form for the signed-in owner or admin. It returns the form or the reason there is
 * none and writes nothing: the owner reviews it and saves through `saveContractWordingAction` (contract-import door 2).
 */
export async function importContractWordingAction(formData: FormData): Promise<ImportContractWordingState> {
  const { currentMember, importContractWording } = await getContainer();
  const member = await currentMember();
  if (member.status === "signed_out") redirect("/login");

  const file = formData.get("file");
  const attached = file instanceof File && (file.size > 0 || file.name !== "") ? file : undefined;
  const result = await importContractWording({
    role: member.status === "member" ? member.role : null,
    file: attached ? { name: attached.name, bytes: new Uint8Array(await attached.arrayBuffer()) } : undefined,
  });
  return result.ok ? { status: "imported", form: result.form } : { status: "failed", code: result.code };
}
