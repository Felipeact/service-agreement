import { notFound, redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { isUuid } from "@/domain/imports";
import { canWriteTemplates } from "../_components/state";

/** The signed-in member, or a redirect to /login. */
async function signedInMember() {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  return { container, member };
}

/** The same, for the editors: only owners and admins write templates, so anyone else goes back to the list. */
async function templateWriter() {
  const found = await signedInMember();
  if (!canWriteTemplates(found.member.role)) redirect("/templates");
  return found;
}

/**
 * What the Templates page reads: the templates (a writer whose company has none is given the starters first), whether the org
 * has its own contract wording, and the moment the ages count from. Every member sees the list.
 */
export async function loadTemplates() {
  const { container, member } = await signedInMember();
  const { listAgreementTemplates, ensureStarterTemplates, getContractWording, clock } = container;
  const [list, wording] = await Promise.all([canWriteTemplates(member.role) ? ensureStarterTemplates() : listAgreementTemplates(), getContractWording()]);
  return { role: member.role, list, wording, now: clock.now() };
}

/** The empty editor: the org's equipment types and name. A member who cannot write goes back to the list. */
export async function loadNewTemplate() {
  const { container, member } = await templateWriter();
  return { orgName: member.orgName, types: await container.listAssetTypes() };
}

/**
 * The editor with a template's latest version. A malformed id, an unknown one, another org's, an archived one and the system
 * template (which no member edits) are 404 (agreement-templates AC 21, Surface).
 */
export async function loadTemplateToEdit(templateId: string) {
  const { container, member } = await templateWriter();
  if (!isUuid(templateId)) notFound();
  const [list, types] = await Promise.all([container.listAgreementTemplates(), container.listAssetTypes()]);
  if (!list.ok) throw new Error("The template list could not be read");
  const template = list.templates.find((candidate) => candidate.id === templateId && !candidate.system);
  if (!template) notFound();
  return { orgName: member.orgName, template, types };
}

/** The org's own contract wording, or the system wording while it has none. */
export async function loadContractWording() {
  const { container, member } = await templateWriter();
  const wording = await container.getContractWording();
  if (!wording.ok) throw new Error("The contract wording could not be read");
  return { orgName: member.orgName, wording };
}
