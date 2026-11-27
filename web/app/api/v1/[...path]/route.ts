import type { NextRequest } from "next/server";
import { accessOf, checkApiRate, getApiContainer, planAccessMessage, planAllows, resolveRoute, statusForFailure } from "@/composition";

const MAX_BODY_BYTES = 16_000;
const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
const failure = (status: number, message: string, headers: Record<string, string> = {}) => json(status, { error: { message } }, headers);

function metadataUrl(request: NextRequest): string {
  const base = (process.env.APP_BASE_URL?.trim() || request.nextUrl.origin).replace(/\/$/, "");
  return `${base}/.well-known/oauth-protected-resource/api/v1`;
}

/**
 * The REST API (API door 1): `/api/v1/<resource>`. The caller proves who they are with a member's access token; the route finds the
 * matching tool, and the shared tool layer does the checks, the role and plan rules and the audit, exactly as for MCP.
 */
async function handle(request: NextRequest, context: RouteContext<"/api/v1/[...path]">) {
  const token = /^Bearer ([A-Za-z0-9._~+/=-]{20,4096})$/.exec(request.headers.get("authorization") ?? "")?.[1];
  const unauthorized = () => failure(401, "Send a member's access token as `Authorization: Bearer <token>`.", { "WWW-Authenticate": `Bearer resource_metadata="${metadataUrl(request)}"` });
  if (!token) return unauthorized();
  try {
    const { path } = await context.params;
    let body: unknown;
    if (request.method === "POST") {
      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES) return failure(413, "The body is too large.");
      if (raw.trim() !== "") {
        try {
          body = JSON.parse(raw);
        } catch {
          return failure(400, "The body is not valid JSON.");
        }
      }
    }
    const resolved = resolveRoute(request.method, `/${path.join("/")}`, Object.fromEntries(request.nextUrl.searchParams), body);
    if (!resolved.ok) return failure(resolved.status, resolved.error, resolved.status === 405 ? { Allow: "GET, POST" } : {});
    const container = await getApiContainer(token);
    if (!container) return unauthorized();
    if (!planAllows(container.caller.plan, "api", resolved.access)) return failure(403, planAccessMessage("api", resolved.access, container.caller.plan));
    const decision = checkApiRate(container.caller.userId, accessOf(container.caller.plan).callsPerMinute);
    if (!decision.allowed) return failure(429, "Too many requests. Slow down.", { "Retry-After": String(decision.retryAfterSeconds) });
    const result = await container.runTool(resolved.tool, resolved.args, container.caller);
    if (!result.ok) return failure(statusForFailure(result.error), result.error);
    return json(request.method === "POST" ? 201 : 200, { data: result.data });
  } catch (error) {
    // A token Supabase rejects lands here too; the log carries no token and no body.
    console.error(`API request failed: ${error instanceof Error ? error.name : "error"}`);
    return unauthorized();
  }
}

export const GET = handle;
export const POST = handle;
