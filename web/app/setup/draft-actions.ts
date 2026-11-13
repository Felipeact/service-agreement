"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { MAX_DRAFT_FILE_BYTES } from "@/application/use-cases/draft-catalog";
import type { AcceptFormState, DraftFormState } from "@/components/setup/draft-state";

/** The attached file, or `undefined` when the owner chose none (an empty file input still posts a nameless, empty File). */
function readFile(formData: FormData): File | undefined {
  const file = formData.get("file");
  return file instanceof File && (file.size > 0 || file.name !== "") ? file : undefined;
}

/**
 * Drafts a catalog for the signed-in owner or admin's empty catalog. Returns the draft or the reason there is none; it writes nothing
 * (other-trade-draft door 3).
 */
export async function draftCatalogAction(_state: DraftFormState, formData: FormData): Promise<DraftFormState> {
  const trade = String(formData.get("trade") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const { currentMember, draftCatalog } = await getContainer();
  const member = await currentMember();
  if (member.status === "signed_out") redirect("/login");
  const kept = { trade, notes };

  const file = readFile(formData);
  if (file && file.size > MAX_DRAFT_FILE_BYTES) return { status: "failed", code: "too_large", ...kept };
  const result = await draftCatalog({
    role: member.status === "member" ? member.role : null,
    trade,
    notes,
    file: file ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } : undefined,
  });
  return result.ok ? { status: "drafted", trade: result.trade, types: result.types } : { status: "failed", code: result.code, ...kept };
}

/**
 * Writes the reviewed draft once and whole, then refreshes `/setup` so it shows the new catalog (a revalidation, not a redirect: only
 * Pipeline sends anyone to `/setup`, first-login-setup C2805). A refusal comes back as state.
 */
export async function acceptDraftAction(_state: AcceptFormState, formData: FormData): Promise<AcceptFormState> {
  const { currentMember, acceptCatalogDraft } = await getContainer();
  const member = await currentMember();
  if (member.status === "signed_out") redirect("/login");

  let types: unknown;
  try {
    types = JSON.parse(String(formData.get("types") ?? ""));
  } catch {
    return { status: "failed", code: "invalid" };
  }
  const result = await acceptCatalogDraft({
    role: member.status === "member" ? member.role : null,
    orgId: member.status === "member" ? member.orgId : "",
    trade: String(formData.get("trade") ?? ""),
    types,
  });
  if (!result.ok) return { status: "failed", code: result.code };
  revalidatePath("/setup");
  return { status: "accepted", added: result.added };
}
