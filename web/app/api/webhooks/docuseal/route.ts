import type { NextRequest } from "next/server";
import { getWebhookContainer } from "@/composition";
import { isDocusealSignature } from "@/domain/contract";

const STATUS = { unauthorized: 401, malformed: 400, unavailable: 503 } as const;

const answer = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Seconds. Fetching the two signed files takes up to 30 s each (signature-webhook door 5). */
export const maxDuration = 90;

/**
 * DocuSeal's signed webhook (signature-webhook door 4). A header of the wrong shape is refused here; the signature itself is
 * checked by the database, which alone holds the secret (door 1). Answers `{ outcome, reason? }`. A failure after a valid
 * signature is `503`, which DocuSeal retries; the log carries no body, no header and no address.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("x-docuseal-signature");
  if (!isDocusealSignature(signature)) return answer(401, { error: "unauthorized" });

  try {
    // The raw text: the signature covers these exact bytes.
    const body = await request.text();
    const { receive } = await getWebhookContainer();
    const result = await receive({ body, signature });
    if (result.ok) return answer(200, result.reason ? { outcome: result.outcome, reason: result.reason } : { outcome: result.outcome });
    return answer(STATUS[result.code], { error: result.code });
  } catch (error) {
    console.error(`DocuSeal webhook failed: ${error instanceof Error ? error.message : "error"}`);
    return answer(503, { error: "unavailable" });
  }
}
