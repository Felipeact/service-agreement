import { NextResponse, type NextRequest } from "next/server";
import { getContainer } from "@/composition";
import { signedDocumentFilename, type SignedDocumentKind } from "@/domain/contract";
import { isUuid } from "@/domain/imports";

const empty = (status: number) => new Response(null, { status });

/**
 * Any member of the org downloads what the webhook stored, exactly as DocuSeal produced it (signature-webhook door 6).
 * An id that is malformed, a contract of another org, and a contract with no such file are all the same empty `404`.
 */
export async function signedDownload(request: NextRequest, contractId: string, kind: SignedDocumentKind) {
  if (!isUuid(contractId)) return empty(404);

  const { currentMember, contractReader, signedCopyReader } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") return NextResponse.redirect(new URL("/login", request.url));

  const contract = await contractReader.get(contractId);
  if (!contract) return empty(404);
  const copy = await signedCopyReader.get(contractId, kind);
  if (!copy) return empty(404);

  return new Response(copy.bytes as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${signedDocumentFilename(contract.number, kind)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
