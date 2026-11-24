import { NextResponse, type NextRequest } from "next/server";
import { getContainer } from "@/composition";
import { isUuid } from "@/domain/imports";
import { contractPreviewPdf } from "../../../_data-access/preview-pdf";

/** Seconds, as the editor's preview. */
export const maxDuration = 60;

const empty = (status: number) => new Response(null, { status });

/**
 * The org's saved contract wording (the standard wording while it has none) as a PDF, for the preview page (rich-templates). Any
 * member may preview it; `?agreement=<id>` draws it on one of the org's own agreements. It writes nothing.
 */
export async function GET(request: NextRequest) {
  const agreementId = request.nextUrl.searchParams.get("agreement");
  if (agreementId !== null && !isUuid(agreementId)) return empty(404);

  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") return NextResponse.redirect(new URL("/login", request.url));

  try {
    const wording = await container.getContractWording();
    if (!wording.ok) throw new Error("The contract wording could not be read");
    const drawn = await contractPreviewPdf(container, member.orgId, wording.body, agreementId);
    if (!drawn.ok) return empty(404);
    return new Response(drawn.bytes as BodyInit, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="contract-preview.pdf"`, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error(`Contract wording preview failed for org ${member.orgId}`, error);
    return empty(503);
  }
}
