import { NextResponse, type NextRequest } from "next/server";
import { getContainer } from "@/composition";
import { buildAgreementDocument } from "@/domain/agreement";
import { isUuid } from "@/domain/imports";

/** Seconds. Rendering 2,000 assets measured about 22 s (C870); this is more than twice that. */
export const maxDuration = 60;

const empty = (status: number) => new Response(null, { status });

/** `?version=<n>` as a positive whole number, or no version: anything else renders the current one. */
function versionOf(value: string | null): number | undefined {
  return value !== null && /^[1-9]\d*$/.test(value) ? Number(value) : undefined;
}

/** Any member of the org downloads the agreement as a PDF, for one version (door 3). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ agreementId: string }> }) {
  const { agreementId } = await params;
  if (!isUuid(agreementId)) return empty(404);

  const { currentMember, agreementReader, getOrgSettings, documentRenderer } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") return NextResponse.redirect(new URL("/login", request.url));

  const agreement = await agreementReader.get(agreementId, versionOf(request.nextUrl.searchParams.get("version")));
  if (!agreement) return empty(404);

  try {
    const settings = await getOrgSettings(member.orgId);
    if (!settings) throw new Error(`org ${member.orgId} has no settings row`);
    const bytes = await documentRenderer.renderAgreement(buildAgreementDocument(agreement, settings));
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${agreement.number}-v${agreement.shown.versionNo}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error(`Agreement PDF failed for ${agreementId}`, error);
    return empty(503);
  }
}
