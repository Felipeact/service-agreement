import type { NextRequest } from "next/server";
import { canWriteTemplates } from "@/components/templates/state";
import { getContainer } from "@/composition";
import { buildContractPreviewDocument } from "@/domain/contract";
import { bodyFromContractForm, readContractFormInput } from "@/domain/contract/layout-form";
import { itemWords } from "@/domain/org-settings";
import { today } from "@/lib/business-day";

/** Seconds, as the agreement preview: a contract with its schedules renders in well under this. */
export const maxDuration = 60;

/** The wording is capped at 60,000 characters as JSON; the form that makes it is a little larger, and nothing past this is read. */
const MAX_REQUEST_CHARS = 200_000;

const empty = (status: number) => new Response(null, { status });
const invalid = (errors: { field: string; message: string }[]) => Response.json({ errors }, { status: 422 });

/**
 * The contract PDF of the editor's current values on sample data, for the preview beside the wording editor (block-editor AC 44,
 * AC 45). Owners and admins only, like the editor. It builds a document and writes nothing.
 */
export async function POST(request: NextRequest) {
  const { currentMember, getOrgSettings, contractRenderer, tenantLogo, clock } = await getContainer();
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
  const read = readContractFormInput(json);
  if (!read.ok) return invalid(read.errors);
  const checked = bodyFromContractForm(read.input);
  if (!checked.ok) return invalid(Object.entries(checked.errors).map(([field, message]) => ({ field, message })));

  try {
    const settings = await getOrgSettings(member.orgId);
    if (!settings) throw new Error(`org ${member.orgId} has no settings row`);
    const document = buildContractPreviewDocument(checked.body, settings, await tenantLogo(member.orgId), today(clock.now()), itemWords(settings.itemSingular, settings.itemPlural));
    const bytes = await contractRenderer.renderContract(document);
    return new Response(bytes as BodyInit, { headers: { "Content-Type": "application/pdf", "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error(`Contract wording preview failed for org ${member.orgId}`, error);
    return empty(503);
  }
}
