import type { NextRequest } from "next/server";
import { openApiDocument } from "@/composition";

/** The OpenAPI 3.1 description of the REST API, public so a developer can read it before signing in. */
export function GET(request: NextRequest) {
  const base = (process.env.APP_BASE_URL?.trim() || request.nextUrl.origin).replace(/\/$/, "");
  return Response.json(openApiDocument(base), { headers: { "Cache-Control": "public, max-age=300" } });
}
