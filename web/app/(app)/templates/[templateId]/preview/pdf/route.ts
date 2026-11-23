import { NextResponse, type NextRequest } from "next/server";
import { getContainer } from "@/composition";
import { isUuid } from "@/domain/imports";
import { agreementPreviewPdf } from "../../../_data-access/preview-pdf";

/** Seconds, as the editor's preview. */
export const maxDuration = 60;

const empty = (status: number) => new Response(null, { status });

/**
 * The saved version of an agreement template as a PDF, for the preview page (rich-templates). Any member reads templates, so any
 * member may preview one; `?agreement=<id>` draws it on one of the org's own agreements. It writes nothing.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = await params;
  if (!isUuid(templateId)) return empty(404);
  const agreementId = request.nextUrl.searchParams.get("agreement");
  if (agreementId !== null && !isUuid(agreementId)) return empty(404);

  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") return NextResponse.redirect(new URL("/login", request.url));

  try {
    const list = await container.listAgreementTemplates();
    if (!list.ok) throw new Error("The template list could not be read");
    const template = list.templates.find((candidate) => candidate.id === templateId);
    if (!template) return empty(404);
    const drawn = await agreementPreviewPdf(container, member.orgId, template.body, agreementId);
    if (!drawn.ok) return empty(404);
    return new Response(drawn.bytes as BodyInit, {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="template-preview.pdf"`, "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error(`Template preview failed for ${templateId}`, error);
    return empty(503);
  }
}
