import type { NextRequest } from "next/server";
import { checkMcpRate, getMcpContainer, handleMcp, planAccessMessage, planAllows, serverIcons } from "@/composition";
import { publicOrigin } from "@/lib/public-origin";

const MAX_BODY_BYTES = 32_000;
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

/** The address of the protected-resource document (RFC 9728) a client follows from a 401 to find the authorization server. */
function metadataUrl(request: NextRequest): string {
  const base = (process.env.APP_BASE_URL?.trim() || request.nextUrl.origin).replace(/\/$/, "");
  return `${base}/.well-known/oauth-protected-resource/api/mcp`;
}

const unauthorized = (request: NextRequest) => json(401, { error: "unauthorized" }, { "WWW-Authenticate": `Bearer resource_metadata="${metadataUrl(request)}"` });

/**
 * The Service Pacts MCP endpoint (MCP door 2): Streamable HTTP, one JSON-RPC message per POST. The caller proves who they are with a
 * Supabase access token; the org and role come from that member's own membership, never from a tool argument.
 */
export async function POST(request: NextRequest) {
  const token = /^Bearer ([A-Za-z0-9._~+/=-]{20,4096})$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return unauthorized(request);
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json(413, { error: "too_large" });
    let message: unknown;
    try {
      message = JSON.parse(raw);
    } catch {
      return json(400, { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error." } });
    }
    const container = await getMcpContainer(token);
    if (!container) return unauthorized(request);
    if (!planAllows(container.caller.plan, "mcp", "read")) return json(403, { error: "plan_required", message: planAccessMessage("mcp", "read", container.caller.plan) });
    const decision = checkMcpRate(container.caller.userId);
    if (!decision.allowed) return json(429, { error: "rate_limited" }, { "Retry-After": String(decision.retryAfterSeconds) });
    const origin = publicOrigin(request.nextUrl, request.headers, process.env.APP_BASE_URL);
    const answer = await handleMcp(message, {
      icons: serverIcons(origin),
      websiteUrl: origin,
      list: () => container.toolsFor(container.caller),
      call: (name, args) => container.runTool(name, args, container.caller),
    });
    return answer === null ? new Response(null, { status: 202, headers: { "Cache-Control": "no-store" } }) : json(200, answer);
  } catch (error) {
    // A token Supabase rejects lands here too; the log carries no token and no body.
    console.error(`MCP request failed: ${error instanceof Error ? error.name : "error"}`);
    return unauthorized(request);
  }
}

/** Streamable HTTP lets a server refuse the optional GET event stream. */
export function GET() {
  return new Response(null, { status: 405, headers: { Allow: "POST" } });
}
