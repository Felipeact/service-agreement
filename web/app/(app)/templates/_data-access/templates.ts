import { notFound, redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { isUuid } from "@/domain/imports";
import { canWriteTemplates } from "../_components/state";
import { NEUTRAL_ACCENT } from "@/domain/agreement";
import { today } from "@/lib/business-day";
import type { EditorPageEnv } from "../_components/rich-editor/env";

type Found = Awaited<ReturnType<typeof signedInMember>>;

/**
 * What the Word-style editor draws around the page and offers in its preview: the letterhead details, the colour, the logo and
 * picture addresses, and the org's 20 most recent agreements to preview on. A part that cannot be read is left out, never a failed page.
 */
async function editorEnv({ container, member }: Found): Promise<EditorPageEnv> {
  // Each read stands alone: a failure leaves its part out (no logo, no recent agreements), it never fails the editor.
  const safe = async <T,>(read: () => T | Promise<T>, fallback: T): Promise<T> => {
    try {
      return await read();
    } catch {
      return fallback;
    }
  };
  const [settings, logoPath, agreements] = await Promise.all([
    safe(() => container.getOrgSettings(member.orgId), null),
    safe(() => container.logo.current(member.orgId), null),
    safe(() => container.listAgreements({}, today(container.clock.now())), []),
  ]);
  return {
    orgName: member.orgName,
    address: settings?.address ?? null,
    phone: settings?.phone ?? null,
    accent: settings?.accentColor ?? NEUTRAL_ACCENT,
    logoUrl: await safe(() => container.logo.url(logoPath), null),
    imageBase: await safe(() => container.templateImages.url(""), ""),
    agreements: agreements
      .filter((row) => row.number !== null)
      .slice(0, 20)
      .map((row) => ({ id: row.id, label: `${row.number} for ${row.customer}, ${row.site}` })),
  };
}

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
  const [types, env] = await Promise.all([container.listAssetTypes(), editorEnv({ container, member })]);
  return { orgName: member.orgName, types, env };
}

/**
 * The editor with a template's latest version. A malformed id, an unknown one, another org's, an archived one and the system
 * template (which no member edits) are 404 (agreement-templates AC 21, Surface).
 */
export async function loadTemplateToEdit(templateId: string) {
  const { container, member } = await templateWriter();
  if (!isUuid(templateId)) notFound();
  const [list, types, env] = await Promise.all([container.listAgreementTemplates(), container.listAssetTypes(), editorEnv({ container, member })]);
  if (!list.ok) throw new Error("The template list could not be read");
  const template = list.templates.find((candidate) => candidate.id === templateId && !candidate.system);
  if (!template) notFound();
  return { orgName: member.orgName, template, types, env };
}

/** The org's own contract wording, or the system wording while it has none. */
export async function loadContractWording() {
  const { container, member } = await templateWriter();
  const [wording, env] = await Promise.all([container.getContractWording(), editorEnv({ container, member })]);
  if (!wording.ok) throw new Error("The contract wording could not be read");
  return { orgName: member.orgName, wording, env };
}

/**
 * A saved agreement template to preview, for any member: its name, latest version body and whether the member may edit it, with
 * the org's recent agreements to draw it on. A malformed, unknown or archived id is 404.
 */
export async function loadTemplatePreview(templateId: string) {
  const found = await signedInMember();
  if (!isUuid(templateId)) notFound();
  const [list, env] = await Promise.all([found.container.listAgreementTemplates(), editorEnv(found)]);
  if (!list.ok) throw new Error("The template list could not be read");
  const template = list.templates.find((candidate) => candidate.id === templateId);
  if (!template) notFound();
  return { template, canEdit: canWriteTemplates(found.member.role) && !template.system, agreements: env.agreements };
}

/** The org's contract wording to preview (the system wording while it has none), for any member. */
export async function loadContractPreview() {
  const found = await signedInMember();
  const [wording, env] = await Promise.all([found.container.getContractWording(), editorEnv(found)]);
  if (!wording.ok) throw new Error("The contract wording could not be read");
  return { wording, canEdit: canWriteTemplates(found.member.role), agreements: env.agreements };
}
