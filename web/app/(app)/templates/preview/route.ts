import type { NextRequest } from "next/server";
import { canWriteTemplates } from "@/components/templates/state";
import { getContainer } from "@/composition";
import { buildTemplatePreviewDocument } from "@/domain/agreement";
import { bodyFromTemplateForm, readTemplateFormInput, type FieldError } from "@/domain/agreement/template-form";
import { itemWords } from "@/domain/org-settings";

/** Seconds. Rendering a long agreement measured about 22 s (C870); a template with 20 preset lines is far shorter. */
export const maxDuration = 60;

/** A template body is capped at 60,000 characters as JSON; the form that makes it is a little larger, and nothing past this is read. */
const MAX_REQUEST_CHARS = 200_000;

const empty = (status: number) => new Response(null, { status });
const invalid = (errors: FieldError[]) => Response.json({ errors }, { status: 422 });

/**
 * The agreement PDF of the editor's current values on sample data, for the preview beside the form (template-flow S4). Owners
 * and admins only, like the editor. It builds a document and writes nothing: no template, version or agreement is touched.
 */
export async function POST(request: NextRequest) {
  const { currentMember, getOrgSettings, documentRenderer, tenantLogo } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") return empty(401);
  if (!canWriteTemplates(member.role)) return empty(403);

  const posted = await request.text();
  if (posted.length > MAX_REQUEST_CHARS) return invalid([{ field: "body", message: "The template is too large to preview." }]);
  let json: unknown;
  try {
    json = JSON.parse(posted);
  } catch {
    return invalid([{ field: "body", message: "Send the template's fields as JSON." }]);
  }
  const read = readTemplateFormInput(json);
  if (!read.ok) return invalid(read.errors);
  const checked = bodyFromTemplateForm(read.input);
  if (!checked.ok) return invalid(Object.entries(checked.errors).map(([field, message]) => ({ field, message })));

  try {
    const settings = await getOrgSettings(member.orgId);
    if (!settings) throw new Error(`org ${member.orgId} has no settings row`);
    const document = buildTemplatePreviewDocument(checked.body, settings, await tenantLogo(member.orgId), itemWords(settings.itemSingular, settings.itemPlural));
    const bytes = await documentRenderer.renderAgreement(document);
    return new Response(bytes as BodyInit, { headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error(`Template preview failed for org ${member.orgId}`, error);
    return empty(503);
  }
}
