import type { ReceiveSignatureEventResult, SignatureWebhooks, SignedDocuments, WebhookAnswer } from "@/application/ports";

type Delivery = { body: string; signature: string };

/** What the route answers for an answer that needs nothing more: `documents_needed` never reaches here. */
function settled(answer: Exclude<WebhookAnswer, { outcome: "documents_needed" }>): ReceiveSignatureEventResult {
  return answer.outcome === "ignored" ? { ok: true, outcome: "ignored", reason: answer.reason } : { ok: true, outcome: answer.outcome };
}

/**
 * One DocuSeal delivery (signature-webhook Flow hops 2 to 4). The database verifies and applies it. For the final event it
 * answers `documents_needed` first and writes nothing; the app then downloads the two files and calls again with them, so the
 * contract is never `completed` without its signed copy. A delivery that cannot finish is `unavailable`, and DocuSeal retries it.
 */
export function makeReceiveSignatureEvent(webhooks: SignatureWebhooks, documents: SignedDocuments) {
  return async function receiveSignatureEvent(delivery: Delivery): Promise<ReceiveSignatureEventResult> {
    const first = await webhooks.receive(delivery);
    if (!first.ok) return first;
    if (first.answer.outcome !== "documents_needed") return settled(first.answer);

    const fetched = await documents.fetch(first.answer.documents);
    if (!fetched.ok) return { ok: false, code: "unavailable" };

    const second = await webhooks.receive({
      ...delivery,
      documents: fetched.files.map((file) => ({ kind: file.kind, content: Buffer.from(file.bytes).toString("base64") })),
    });
    if (!second.ok) return second;
    // The database asks for files only on a call that has none, so a second `documents_needed` is not an answer it gives.
    return second.answer.outcome === "documents_needed" ? { ok: false, code: "unavailable" } : settled(second.answer);
  };
}
