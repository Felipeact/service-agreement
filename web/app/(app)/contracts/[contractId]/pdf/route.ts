import { NextResponse, type NextRequest } from "next/server";
import { getContainer } from "@/composition";
import { buildContractDocument } from "@/domain/contract";
import { isUuid } from "@/domain/imports";
import { itemWords } from "@/domain/org-settings";

/** Seconds. The agreement PDF measured about 22 s for 2,000 assets (C870); this is more than twice that. */
export const maxDuration = 60;

const empty = (status: number) => new Response(null, { status });

/** Any member of the org downloads the contract as a PDF (contract-generation door 4). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params;
  if (!isUuid(contractId)) return empty(404);

  const { currentMember, contractReader, agreementReader, getOrgSettings, contractRenderer } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") return NextResponse.redirect(new URL("/login", request.url));

  const contract = await contractReader.get(contractId);
  // A contract that recorded no parties cannot say who it binds, so there is no document to draw.
  if (!contract || !contract.parties) return empty(404);
  const agreement = await agreementReader.get(contract.agreementId, contract.versionNo);
  if (!agreement) return empty(404);

  try {
    const settings = await getOrgSettings(member.orgId);
    if (!settings) throw new Error(`org ${member.orgId} has no settings row`);
    const bytes = await contractRenderer.renderContract(buildContractDocument(agreement, contract.parties, settings.accentColor, itemWords(settings.itemSingular, settings.itemPlural)));
    return new Response(bytes as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${contract.number}-contract.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error(`Contract PDF failed for ${contractId}`, error);
    return empty(503);
  }
}
