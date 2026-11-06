import type { NextRequest, NextResponse } from "next/server";
import { isPortalToken } from "@/domain/portal";
import { linkExists, linkNotWorkingResponse } from "./portal-gate";

/** A page under `/sign/` with exactly one segment: the customer's signing address (signature-provider door 7). */
const SIGN_PAGE = /^\/sign\/([^/]+)$/;

/**
 * The same shape as `portalGate`, for the same reason: a page streams as `200` under Cache Components, so an address that
 * is malformed or has no link is answered here, in full, with a real `404`. `null` lets the request on.
 */
export async function signingGate(request: NextRequest): Promise<NextResponse | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const token = SIGN_PAGE.exec(request.nextUrl.pathname)?.[1];
  if (token === undefined) return null;
  if (isPortalToken(token) && (await linkExists("signature_view", token))) return null;
  return linkNotWorkingResponse();
}
