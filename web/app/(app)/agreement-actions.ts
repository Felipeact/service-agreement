"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { validateServiceLine } from "@/domain/agreement";
import { isUuid } from "@/domain/imports";
import type { AgreementInput } from "@/application/use-cases";
import type { CreateAgreementState, LineState, MoveState } from "@/components/agreements/state";
import { canWriteRecords } from "@/components/records/state";

const FORBIDDEN = { status: "forbidden" } as const;
const NOT_FOUND = { status: "not_found" } as const;

/** The container, or `null` when the member may not write agreements. Signed out goes to /login. */
async function writer() {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  return canWriteRecords(member.role) ? container : null;
}

/** Only the three line fields are read: the org comes from the member, the version from the agreement (AC 29). */
function lineFields(formData: FormData) {
  const text = (name: string) => String(formData.get(name) ?? "");
  return { description: text("description"), visitsPerYear: text("visitsPerYear"), costPerVisit: text("costPerVisit") };
}

/** Creates a draft with version 1 on the site, then opens it; a site with a live agreement names that one. */
export async function createAgreementAction(siteId: string): Promise<CreateAgreementState> {
  const container = await writer();
  if (!container) return FORBIDDEN;
  if (!isUuid(siteId)) return NOT_FOUND;
  const created = await container.agreementStore.create(siteId);
  if (created.ok) redirect(`/agreements/${created.id}`);
  if (created.code === "open_exists") return { status: "open_exists", agreementId: created.agreementId, number: created.number };
  return { status: created.code };
}

export async function addServiceLineAction(agreementId: string, formData: FormData): Promise<LineState> {
  const container = await writer();
  if (!container) return FORBIDDEN;
  if (!isUuid(agreementId)) return NOT_FOUND;
  const input = lineFields(formData);
  const checked = validateServiceLine(input);
  if (!checked.ok) return { status: "invalid", errors: checked.errors, values: input };
  const added = await container.serviceLineStore.add(agreementId, checked.value);
  if (!added.ok) return { status: added.code };
  revalidatePath(`/agreements/${agreementId}`);
  return { status: "saved" };
}

export async function updateServiceLineAction(lineId: string, formData: FormData): Promise<LineState> {
  const container = await writer();
  if (!container) return FORBIDDEN;
  if (!isUuid(lineId)) return NOT_FOUND;
  const input = lineFields(formData);
  const checked = validateServiceLine(input);
  if (!checked.ok) return { status: "invalid", errors: checked.errors, values: input };
  const saved = await container.serviceLineStore.update(lineId, checked.value);
  if (!saved.ok) return { status: saved.code };
  revalidatePath("/agreements/[agreementId]", "page");
  return { status: "saved" };
}

export async function removeServiceLineAction(lineId: string): Promise<LineState> {
  const container = await writer();
  if (!container) return FORBIDDEN;
  if (!isUuid(lineId)) return NOT_FOUND;
  const removed = await container.serviceLineStore.remove(lineId);
  if (!removed.ok) return { status: removed.code };
  revalidatePath("/agreements/[agreementId]", "page");
  return { status: "removed" };
}

type Moved = { ok: true } | MoveState;

/** Runs a transition; a refusal becomes the state the page shows, an unexpected failure `unavailable`. */
async function move(agreementId: string, command: AgreementInput): Promise<Moved> {
  const container = await writer();
  if (!container) return FORBIDDEN;
  if (!isUuid(agreementId)) return NOT_FOUND;
  try {
    const result = await container.transitionAgreement({ agreementId, command });
    if (result.ok) return { ok: true };
    const { code } = result.error;
    if (code === "conflict" || code === "not_found" || code === "forbidden") return { status: code };
    return { status: "invalid_transition" };
  } catch (cause) {
    console.error(`Agreement ${command.type} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    return { status: "unavailable" };
  }
}

/** Moves a `changes_requested` agreement back to draft with version n + 1, then opens it. */
export async function reviseAgreementAction(agreementId: string): Promise<MoveState> {
  const moved = await move(agreementId, { type: "revise" });
  if ("ok" in moved) redirect(`/agreements/${agreementId}`);
  return moved;
}

export async function withdrawAgreementAction(agreementId: string): Promise<MoveState> {
  const moved = await move(agreementId, { type: "withdraw" });
  if (!("ok" in moved)) return moved;
  revalidatePath(`/agreements/${agreementId}`);
  return { status: "withdrawn" };
}
