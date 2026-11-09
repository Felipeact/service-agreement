import type { NextRequest } from "next/server";
import { getWebhookContainer } from "@/composition";

const STATUS = { unauthorized: 401, malformed: 400, unavailable: 503 } as const;

const answer = (status: number, body: Record<string, unknown>) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** `t=<unix seconds>` and at least one `v1=<64 hex>`; the database checks the rest. A header of the wrong shape is refused before any work. */
const HEADER_SHAPE = /^(?=.*(?:^|,)t=\d{1,12}(?:,|$))(?=.*(?:^|,)v1=[0-9a-f]{64}(?:,|$))/;

/**
 * Stripe's signed webhook (billing-checkout door 3). The signature is checked by the database, which alone holds the secret.
 * Answers `{ outcome }` or `{ error }`. A failure after a well-formed header is `503`, which Stripe retries; the log carries
 * no body and no header.
 */
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature || !HEADER_SHAPE.test(signature)) return answer(401, { error: "unauthorized" });

  try {
    // The raw text: the signature covers these exact bytes.
    const body = await request.text();
    const { receiveStripe } = await getWebhookContainer();
    const result = await receiveStripe({ body, signature });
    if (result.ok) return answer(200, { outcome: result.outcome });
    return answer(STATUS[result.code], { error: result.code });
  } catch (error) {
    console.error(`Stripe webhook failed: ${error instanceof Error ? error.name : "error"}`);
    return answer(503, { error: "unavailable" });
  }
}
