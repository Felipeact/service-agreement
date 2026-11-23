"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { companyDetailsReady } from "@/domain/org-settings";
import { isStaleStart, validateAgreementTerm, validateServiceLine, validateVersionNote, type ServiceLineInput } from "@/domain/agreement";
import { audienceOf, planLimitMessage } from "@/domain/billing/plan-limits";
import { isUuid } from "@/domain/imports";
import { portalLinkUrl } from "@/domain/portal";
import type { AgreementInput, LinkIssueResult } from "@/application/use-cases";
import type { CreateAgreementState, GenerateLinesState, LineState, LinkState, MoveState, NoteState, ScopeState, TemplateState, TermState } from "@/components/agreements/state";
import { canWriteRecords } from "@/components/records/state";
import { linkBase } from "./link-base";

const FORBIDDEN = { status: "forbidden" } as const;
const NOT_FOUND = { status: "not_found" } as const;

/** The container, or `null` when the member may not write agreements. Signed out goes to /login. */
async function writer() {
  return (await writerWithRole())?.container ?? null;
}

/** The same, with the member's role, for an answer that depends on who is asking. */
async function writerWithRole() {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  return canWriteRecords(member.role) ? { container, role: member.role } : null;
}

/**
 * Only the line fields are read: the org comes from the member, the version from the agreement (AC 29). Months and
 * equipment are every checked box (cadence door 1, 2).
 */
function lineFields(formData: FormData): ServiceLineInput {
  const text = (name: string) => String(formData.get(name) ?? "");
  const all = (name: string) => formData.getAll(name).map(String);
  return { description: text("description"), visitMonths: all("visitMonths"), costPerVisit: text("costPerVisit"), assetTypeIds: all("assetTypeIds") };
}

/**
 * Creates a draft with version 1 on the site, then opens it; a site with a live agreement names that one. With a template
 * version (Use template, agreement-templates AC 24) the draft is pinned to it and starts with its preset lines.
 */
export async function createAgreementAction(siteId: string, templateVersionId?: string): Promise<CreateAgreementState> {
  const ctx = await writerWithRole();
  if (!ctx) return FORBIDDEN;
  if (!isUuid(siteId)) return NOT_FOUND;
  if (templateVersionId !== undefined && !isUuid(templateVersionId)) return { status: "invalid_template" };
  const created = await ctx.container.agreementStore.create(siteId, ...(templateVersionId === undefined ? [] : [templateVersionId]));
  if (created.ok) redirect(`/agreements/${created.id}`);
  if (created.code === "plan_limit") return { status: "plan_limit", ...planLimitMessage("agreements", created, audienceOf(ctx.role)) };
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
  revalidatePath("/pipeline");
  return { status: "saved" };
}

/**
 * Builds the draft's service lines from the equipment on its site: the standard plan for equipment no line covers, one line per
 * frequency with a suggested price. Safe to press twice: a covered type is skipped.
 */
export async function generateServiceLinesAction(agreementId: string): Promise<GenerateLinesState> {
  const container = await writer();
  if (!container) return FORBIDDEN;
  if (!isUuid(agreementId)) return NOT_FOUND;
  const result = await container.generateServiceLines(agreementId);
  if (result.added > 0) {
    revalidatePath(`/agreements/${agreementId}`);
    revalidatePath("/pipeline");
  }
  return result.ok ? { status: "generated", added: result.added } : { status: result.code };
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
  revalidatePath("/pipeline");
  return { status: "saved" };
}

export async function removeServiceLineAction(lineId: string): Promise<LineState> {
  const container = await writer();
  if (!container) return FORBIDDEN;
  if (!isUuid(lineId)) return NOT_FOUND;
  const removed = await container.serviceLineStore.remove(lineId);
  if (!removed.ok) return { status: removed.code };
  revalidatePath("/agreements/[agreementId]", "page");
  revalidatePath("/pipeline");
  return { status: "removed" };
}

/** Saves the start date and months of the current version of a draft (term-dates door 3). */
export async function saveTermAction(agreementId: string, formData: FormData): Promise<TermState> {
  const container = await writer();
  if (!container) return FORBIDDEN;
  if (!isUuid(agreementId)) return NOT_FOUND;
  const input = { start: String(formData.get("termStart") ?? ""), months: String(formData.get("termMonths") ?? "") };
  const checked = validateAgreementTerm(input);
  if (!checked.ok) return { status: "invalid", errors: checked.errors, values: input };
  const saved = await container.agreementTermStore.save(agreementId, checked.value);
  if (saved.ok) {
    revalidatePath(`/agreements/${agreementId}`);
    revalidatePath("/pipeline");
    return { status: "saved" };
  }
  // The form checks the same bounds, so a database refusal of the values is unexpected here.
  return { status: saved.code === "invalid" ? "unavailable" : saved.code };
}

/** Saves the staff note of the current version of a draft (versioning AC 4). */
export async function saveVersionNoteAction(agreementId: string, formData: FormData): Promise<NoteState> {
  const container = await writer();
  if (!container) return FORBIDDEN;
  if (!isUuid(agreementId)) return NOT_FOUND;
  const note = String(formData.get("note") ?? "");
  const checked = validateVersionNote(note);
  if (!checked.ok) return { status: "invalid", errors: { note: checked.error }, values: { note } };
  const saved = await container.versionNoteStore.save(agreementId, checked.value);
  if (saved.ok) {
    revalidatePath(`/agreements/${agreementId}`);
    revalidatePath("/pipeline");
    return { status: "saved" };
  }
  return { status: saved.code === "invalid" ? "unavailable" : saved.code };
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
  revalidatePath("/pipeline");
  return { status: "withdrawn" };
}

/** Runs a send or a re-link as a writer and turns the new secret into the full address, once. */
async function issueLink(
  agreementId: string,
  done: "sent" | "reissued",
  run: (container: NonNullable<Awaited<ReturnType<typeof writer>>>) => Promise<LinkIssueResult>,
): Promise<LinkState> {
  const container = await writer();
  if (!container) return FORBIDDEN;
  if (!isUuid(agreementId)) return NOT_FOUND;
  try {
    const result = await run(container);
    if (!result.ok) return { status: result.code };
    const url = portalLinkUrl(await linkBase(), result.token);
    revalidatePath(`/agreements/${agreementId}`);
    revalidatePath("/pipeline");
    return { status: done, url };
  } catch (cause) {
    console.error(`Agreement ${done === "sent" ? "send" : "new link"} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
    return { status: "unavailable" };
  }
}

/**
 * Sends a draft to the customer: `sent`, frozen, and a link shown once. Two checks come first, and both write nothing:
 * the company's details must be its own and confirmed (`company_unconfirmed`), and a site type no line covers must be
 * acknowledged (`needs_confirmation`, answered by sending again with `confirmUncovered`). p0-launch-fixes AC 11, 14-16.
 */
export async function sendAgreementAction(agreementId: string, email?: string, confirmUncovered = false, confirmStart = false): Promise<LinkState> {
  const container = await writer();
  if (!container) return FORBIDDEN;
  if (!isUuid(agreementId)) return NOT_FOUND;
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  try {
    const settings = await container.getOrgSettings(member.orgId);
    const ready = companyDetailsReady({
      legalName: settings?.legalName ?? null,
      address: settings?.address ?? null,
      phone: settings?.phone ?? null,
      confirmedAt: settings?.companyConfirmedAt ?? null,
    });
    if (!ready.ready) return { status: "company_unconfirmed", problems: ready.problems };
    if (!confirmUncovered) {
      const uncovered = await container.agreementScope.uncovered(agreementId);
      if (uncovered.length > 0) return { status: "needs_confirmation", uncovered };
    }
    // A start date far in the past is almost always a slip (2019 for 2029), and it prints on the agreement: ask before sending.
    if (!confirmStart) {
      const start = (await container.agreementReader.get(agreementId))?.term.start ?? null;
      if (start !== null && isStaleStart(start, new Date())) return { status: "needs_start_confirmation", start };
    }
    // The customer's contact email is where the agreement goes; without one on file the sender gives it first.
    if (!(await container.agreementRecipient.get(agreementId))) {
      const typed = (email ?? "").trim().toLowerCase();
      if (!typed) return { status: "needs_email" };
      if (!(await container.agreementRecipient.set(agreementId, typed))) return { status: "invalid_email" };
    }
  } catch (cause) {
    console.error(`Agreement send failed before sending: ${cause instanceof Error ? cause.message : String(cause)}`);
    return { status: "unavailable" };
  }
  return issueLink(agreementId, "sent", (ready) => ready.sendAgreement(agreementId));
}

/** Switches a draft to another template. Only the pin changes: the lines, term and scope stay as they are. */
export async function setAgreementTemplateAction(agreementId: string, templateVersionId: string): Promise<TemplateState> {
  const container = await writer();
  if (!container) return FORBIDDEN;
  if (!isUuid(agreementId) || !isUuid(templateVersionId)) return NOT_FOUND;
  const done = await container.agreementStore.setTemplate(agreementId, templateVersionId);
  if (!done.ok) return { status: done.code };
  revalidatePath(`/agreements/${agreementId}`);
  revalidatePath("/pipeline");
  return { status: "saved" };
}

/** Leaves one asset out of a draft's scope, or puts it back. The asset stays on the site and in other agreements. */
export async function setScopeExclusionAction(agreementId: string, assetId: string, excluded: boolean): Promise<ScopeState> {
  const container = await writer();
  if (!container) return FORBIDDEN;
  if (!isUuid(agreementId) || !isUuid(assetId)) return NOT_FOUND;
  const done = await container.agreementScope.setExcluded(agreementId, assetId, excluded);
  if (!done.ok) return { status: done.code };
  revalidatePath(`/agreements/${agreementId}`);
  return { status: "saved" };
}

/** Replaces the live link of a sent agreement; the old address stops working. */
export async function reissueLinkAction(agreementId: string): Promise<LinkState> {
  return issueLink(agreementId, "reissued", (container) => container.reissueLink(agreementId));
}
