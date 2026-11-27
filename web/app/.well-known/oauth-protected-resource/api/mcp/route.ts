import type { NextRequest } from "next/server";

/**
 * RFC 9728 protected-resource metadata for the MCP endpoint: tells an MCP client that sign-in is Supabase Auth's OAuth 2.1 server
 * (which must be switched on in the Supabase dashboard) and where to find it.
 */
export function GET(request: NextRequest) {
  const base = (process.env.APP_BASE_URL?.trim() || request.nextUrl.origin).replace(/\/$/, "");
  const issuer = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/auth/v1`;
  return Response.json(
    { resource: `${base}/api/mcp`, authorization_servers: [issuer], bearer_methods_supported: ["header"], scopes_supported: ["openid", "profile", "email"], resource_name: "Service Pacts" },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
