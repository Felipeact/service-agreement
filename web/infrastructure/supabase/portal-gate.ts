import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isPortalToken, LINK_NOT_WORKING } from "@/domain/portal";

/** A page under `/review/` with exactly one segment: the customer's address. The PDF and the actions are not pages. */
const REVIEW_PAGE = /^\/review\/([^/]+)$/;

const NOT_WORKING_PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>Agreement</title></head><body style="margin:0;font-family:system-ui,sans-serif;color:#111827;background:#f6f7f9"><main style="max-width:480px;margin:0 auto;padding:40px 16px"><h1 style="font-size:18px">${LINK_NOT_WORKING.replace("'", "&#39;")}</h1></main></body></html>`;

async function linkExists(token: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return true;
  try {
    const response = await fetch(`${url}/rest/v1/rpc/portal_view`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token_hash: createHash("sha256").update(token, "utf8").digest("hex") }),
      cache: "no-store",
    });
    if (!response.ok) return true;
    return (await response.json()) !== null;
  } catch {
    // The page reads the link again and shows its own error; a failed check must not turn a good link away.
    return true;
  }
}

/**
 * A page cannot change its status once it streams, and under Cache Components it always streams; a rewrite cannot set
 * one either. So an address that is malformed or has no link is answered here, in full, with a real `404`
 * (customer-portal AC 9, door 10). `null` lets the request on.
 */
export async function portalGate(request: NextRequest): Promise<NextResponse | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const token = REVIEW_PAGE.exec(request.nextUrl.pathname)?.[1];
  if (token === undefined) return null;
  if (isPortalToken(token) && (await linkExists(token))) return null;
  return new NextResponse(NOT_WORKING_PAGE, {
    status: 404,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex",
    },
  });
}
