import type { NextRequest } from "next/server";

/** RFC 9728 protected-resource metadata for the REST API: sign-in is the same Supabase Auth OAuth 2.1 server MCP uses. */
export function GET(request: NextRequest) {
  const base = (process.env.APP_BASE_URL?.trim() || request.nextUrl.origin).replace(/\/$/, "");
  const issuer = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/auth/v1`;
  return Response.json(
    { resource: `${base}/api/v1`, authorization_servers: [issuer], bearer_methods_supported: ["header"], scopes_supported: ["openid", "profile", "email"], resource_name: "Service Pacts API" },
    { headers: { "Cache-Control": "public, max-age=300" } },
  );
}
