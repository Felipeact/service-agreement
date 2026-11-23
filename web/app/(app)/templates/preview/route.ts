import type { NextRequest } from "next/server";
import { canWriteTemplates } from "@/app/(app)/templates/_components/state";
import { getContainer } from "@/composition";
import { isRichFormInput, previewBodyFromRichForm, readRichFormInput } from "@/domain/agreement/rich-form";
import { isUuid } from "@/domain/imports";
import {
  isLayoutFormInput,
  previewBodyFromLayoutForm,
  previewBodyFromTemplateForm,
  readLayoutFormInput,
  readTemplateFormInput,
  type FieldError,
} from "@/domain/agreement/template-form";
import type { AgreementTemplateBody } from "@/domain/agreement";
import { agreementPreviewPdf } from "../_data-access/preview-pdf";

/** Seconds. Rendering a long agreement measured about 22 s (C870); a template with 20 preset lines is far shorter. */
export const maxDuration = 60;

/** A designed page is capped at 400,000 characters as JSON; the form that makes it is a little larger, and nothing past this is read. */
const MAX_REQUEST_CHARS = 600_000;

const empty = (status: number) => new Response(null, { status });
const invalid = (errors: FieldError[]) => Response.json({ errors }, { status: 422 });

/**
 * The agreement PDF of the editor's current values on sample data, for the preview beside the form (template-flow S4). Owners
 * and admins only, like the editor. It builds a document and writes nothing: no template, version or agreement is touched.
 * `?agreement=<id>` draws the page on one of the org's own agreements instead of the sample (rich-templates preview page); an id the
 * member cannot read answers 404.
 */
export async function POST(request: NextRequest) {
  const container = await getContainer();
  const { currentMember } = container;
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
  const checked = readBody(json, member.orgId);
  if (!checked.ok) return invalid(checked.errors);

  const agreementId = request.nextUrl.searchParams.get("agreement");
  if (agreementId !== null && !isUuid(agreementId)) return empty(404);

  try {
    const drawn = await agreementPreviewPdf(container, member.orgId, checked.body, agreementId);
    if (!drawn.ok) return empty(404);
    return new Response(drawn.bytes as BodyInit, { headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error(`Template preview failed for org ${member.orgId}`, error);
    return empty(503);
  }
}

/**
 * The posted form as a body to draw. The Word-style editor posts `content` (schema 3, pictures limited to the member's org); the block
 * editor posts `doc` and `layout`; the older text form posts `intro`, `footer` and the two switches (block-editor Landing row 8).
 */
function readBody(json: unknown, orgId: string): { ok: true; body: AgreementTemplateBody } | { ok: false; errors: FieldError[] } {
  const fieldErrors = (errors: Record<string, string>) => Object.entries(errors).map(([field, message]) => ({ field, message }));
  if (isRichFormInput(json)) {
    const read = readRichFormInput(json);
    if (!read.ok) return read;
    const checked = previewBodyFromRichForm(read.input, orgId);
    return checked.ok ? checked : { ok: false, errors: fieldErrors(checked.errors) };
  }
  const read = isLayoutFormInput(json) ? readLayoutFormInput(json) : readTemplateFormInput(json);
  if (!read.ok) return read;
  const checked = isLayoutFormInput(read.input) ? previewBodyFromLayoutForm(read.input) : previewBodyFromTemplateForm(read.input);
  return checked.ok ? checked : { ok: false, errors: fieldErrors(checked.errors) };
}
