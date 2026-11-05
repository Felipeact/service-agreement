import type { NextRequest } from "next/server";
import { getAutomationContainer } from "@/composition";

const TIMESTAMP = /^[0-9]{1,12}$/;
const SIGNATURE = /^sha256=[0-9a-f]{64}$/;

const STATUS = { unauthorized: 401, malformed: 400, not_found: 404, in_flight: 409, unavailable: 503 } as const;

const answer = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * n8n's signed callback (outbox-dispatch door 6). Headers of the wrong shape are refused here; the signature itself is
 * checked by the database, which alone holds the secret (door 3). Answers `{ outcome, reason? }`.
 */
export async function POST(request: NextRequest) {
  const timestamp = request.headers.get("x-sa-timestamp");
  const signature = request.headers.get("x-sa-signature");
  if (!timestamp || !signature || !TIMESTAMP.test(timestamp) || !SIGNATURE.test(signature)) {
    return answer(401, { error: "unauthorized" });
  }

  try {
    // The raw text: the signature covers these exact bytes.
    const body = await request.text();
    const { notify } = await getAutomationContainer(request.nextUrl.origin);
    const result = await notify({ body, timestamp, signature });
    if (result.ok) return answer(200, result.reason ? { outcome: result.outcome, reason: result.reason } : { outcome: result.outcome });
    return answer(STATUS[result.code], { error: result.code });
  } catch (error) {
    console.error("Automation callback failed", error);
    return answer(503, { error: "unavailable" });
  }
}
