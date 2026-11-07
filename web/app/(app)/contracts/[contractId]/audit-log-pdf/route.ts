import type { NextRequest } from "next/server";
import { signedDownload } from "../signed-download";

/** DocuSeal's audit log of the signing (signature-webhook door 6). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params;
  return signedDownload(request, contractId, "audit_log");
}
