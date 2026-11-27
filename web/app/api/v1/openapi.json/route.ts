import type { NextRequest } from "next/server";
import { getContainer, openApiDocument, planAllows } from "@/composition";

/** The OpenAPI 3.1 description of the REST API, for a signed-in owner or admin whose plan includes the API. Nobody else is shown it. */
export async function GET(request: NextRequest) {
  const { currentMember, memberPlan } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") return Response.json({ error: { message: "Sign in to read the API reference." } }, { status: 401 });
  const role = member.billingRole ?? member.role;
  if ((role !== "owner" && role !== "admin") || !planAllows(await memberPlan().catch(() => null), "api", "read")) return Response.json({ error: { message: "The API reference is available to owners and admins on the Team plan and above." } }, { status: 403 });
  const base = (process.env.APP_BASE_URL?.trim() || request.nextUrl.origin).replace(/\/$/, "");
  return Response.json(openApiDocument(base), { headers: { "Cache-Control": "private, no-store" } });
}
