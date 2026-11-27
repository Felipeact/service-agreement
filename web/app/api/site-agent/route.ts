import type { NextRequest } from "next/server";
import { getSiteAgentContainer } from "@/composition";
import { MAX_QUESTION_LENGTH, UNAVAILABLE_MESSAGE } from "@/domain/site-agent";

const MAX_BODY_BYTES = 12_000;
const answer = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * The public site agent (site agent door 3). Anonymous on purpose: no cookie is read and no database is touched. The proxy limits
 * each address (10 a minute, 80 a day) before this runs; the body is small, and the answer is a reply and at most one public link.
 */
export async function POST(request: NextRequest) {
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return answer(413, { ok: false, error: `Keep the question under ${MAX_QUESTION_LENGTH} characters.` });
    let body: { question?: unknown; history?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return answer(400, { ok: false, error: "Send a question." });
    }
    const { askSiteAgent } = getSiteAgentContainer();
    const result = await askSiteAgent({ question: body?.question, history: body?.history });
    // A refused or unanswered question is a normal answer the chat shows, so it is not an HTTP error.
    return answer(200, result);
  } catch (error) {
    console.error(`Site agent request failed: ${error instanceof Error ? error.name : "error"}`);
    return answer(503, { ok: false, error: UNAVAILABLE_MESSAGE });
  }
}
