"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { isUuid } from "@/domain/imports";
import { bodyFromTemplateForm, type TemplateFormInput } from "@/domain/agreement/template-form";
import {
  canWriteTemplates,
  NAME_TAKEN_FIELD_MESSAGE,
  type ArchiveTemplateState,
  type DuplicateTemplateState,
  type SaveTemplateState,
} from "@/components/templates/state";

/** The container of a member who may write templates, `null` for one who may not; signed out goes to /login. The org is the member's own. */
async function writer() {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  return canWriteTemplates(member.role) ? container : null;
}

/**
 * Saves the editor's fields as the next version of the template (a new template when `templateId` is null), then returns to the
 * list with it selected. An invalid body answers each field's message and keeps what was typed (agreement-templates AC 18).
 */
export async function saveAgreementTemplateAction(templateId: string | null, input: TemplateFormInput): Promise<SaveTemplateState> {
  const container = await writer();
  if (!container) return { status: "forbidden" };
  if (templateId !== null && !isUuid(templateId)) return { status: "not_found" };

  const checked = bodyFromTemplateForm(input);
  if (!checked.ok) return { status: "invalid", errors: checked.errors, values: input };

  const saved = await container.saveAgreementTemplate(templateId, checked.body);
  if (!saved.ok) {
    if (saved.code === "name_taken") return { status: "invalid", errors: { name: NAME_TAKEN_FIELD_MESSAGE }, values: input };
    return { status: saved.code === "invalid" ? "unavailable" : saved.code };
  }
  revalidatePath("/templates");
  redirect(`/templates?selected=${saved.templateId}`);
}

/** Saves a copy under `<name> (copy)` and opens its editor (agreement-templates AC 19). */
export async function duplicateTemplateAction(templateId: string): Promise<DuplicateTemplateState> {
  const container = await writer();
  if (!container) return { status: "forbidden" };
  if (!isUuid(templateId)) return { status: "not_found" };
  const copied = await container.duplicateAgreementTemplate(templateId);
  if (!copied.ok) return { status: copied.code === "invalid" ? "unavailable" : copied.code };
  revalidatePath("/templates");
  redirect(`/templates/${copied.templateId}`);
}

/** Archives the template: it leaves the list, its versions and the agreements pinned to them stay (agreement-templates AC 20). */
export async function archiveTemplateAction(templateId: string): Promise<ArchiveTemplateState> {
  const container = await writer();
  if (!container) return { status: "forbidden" };
  if (!isUuid(templateId)) return { status: "not_found" };
  const archived = await container.archiveAgreementTemplate(templateId);
  if (!archived.ok) return { status: archived.code === "invalid" || archived.code === "name_taken" ? "unavailable" : archived.code };
  revalidatePath("/templates");
  return { status: "archived" };
}
