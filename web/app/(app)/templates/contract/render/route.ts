import type { NextRequest } from "next/server";
import { canWriteTemplates } from "@/app/(app)/templates/_components/state";
import { getContainer } from "@/composition";
import { bodyFromContractRichForm, isContractRichFormInput, readContractRichFormInput } from "@/domain/contract/rich-form";
import { isUuid } from "@/domain/imports";
import { bodyFromContractForm, readContractFormInput } from "@/domain/contract/layout-form";
import { contractPreviewPdf } from "../../_data-access/preview-pdf";

/** Seconds, as the agreement preview: a contract with its schedules renders in well under this. */
export const maxDuration = 60;

/** The wording is capped at 60,000 characters as JSON; the form that makes it is a little larger, and nothing past this is read. */
const MAX_REQUEST_CHARS = 600_000;

const empty = (status: number) => new Response(null, { status });
const invalid = (errors: { field: string; message: string }[]) => Response.json({ errors }, { status: 422 });

/**
 * The contract PDF of the editor's current values on sample data, for the preview beside the wording editor (block-editor AC 44,
 * AC 45). Owners and admins only, like the editor. It builds a document and writes nothing. `?agreement=<id>` draws it on one of the
 * org's own agreements instead of the sample (rich-templates preview page); an id the member cannot read answers 404.
 */
export async function POST(request: NextRequest) {
  const container = await getContainer();
  const { currentMember } = container;
  const member = await currentMember();
  if (member.status !== "member") return empty(401);
  if (!canWriteTemplates(member.role)) return empty(403);

  const posted = await request.text();
  if (posted.length > MAX_REQUEST_CHARS) return invalid([{ field: "body", message: "The wording is too large to preview." }]);
  let json: unknown;
  try {
    json = JSON.parse(posted);
  } catch {
    return invalid([{ field: "body", message: "Send the wording's fields as JSON." }]);
  }
  // The Word-style editor posts `content` (schema 3, pictures limited to the member's org); the block editor posts `doc` and `layout`.
  const rich = isContractRichFormInput(json);
  const read = rich ? readContractRichFormInput(json) : readContractFormInput(json);
  if (!read.ok) return invalid(read.errors);
  const checked = rich ? bodyFromContractRichForm(read.input as Parameters<typeof bodyFromContractRichForm>[0], member.orgId) : bodyFromContractForm(read.input as Parameters<typeof bodyFromContractForm>[0]);
  if (!checked.ok) return invalid(Object.entries(checked.errors).map(([field, message]) => ({ field, message })));

  const agreementId = request.nextUrl.searchParams.get("agreement");
  if (agreementId !== null && !isUuid(agreementId)) return empty(404);

  try {
    const drawn = await contractPreviewPdf(container, member.orgId, checked.body, agreementId);
    if (!drawn.ok) return empty(404);
    return new Response(drawn.bytes as BodyInit, { headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error(`Contract wording preview failed for org ${member.orgId}`, error);
    return empty(503);
  }
}
