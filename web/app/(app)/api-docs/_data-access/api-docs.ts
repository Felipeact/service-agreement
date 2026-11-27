import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getContainer, openApiDocument, planAllows } from "@/composition";

/**
 * The API reference for the signed-in owner or admin. Signed out goes to /login; a member whose role or plan does not include the
 * API goes back to the Pipeline, so the reference is never shown to a company that cannot use it. The document is built on the
 * server and handed to the page, so there is no public address to fetch it from.
 */
export async function loadApiDocs(): Promise<{ spec: Record<string, unknown>; plan: string }> {
  const { currentMember, memberPlan } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const role = member.billingRole ?? member.role;
  const plan = await memberPlan().catch(() => null);
  if ((role !== "owner" && role !== "admin") || !plan || !planAllows(plan, "api", "read")) redirect("/pipeline");
  const configured = process.env.APP_BASE_URL?.trim();
  const sent = await headers();
  const host = sent.get("x-forwarded-host") ?? sent.get("host");
  const base = configured || (host ? `${sent.get("x-forwarded-proto") ?? "https"}://${host}` : "https://servicepacts.com");
  return { spec: openApiDocument(base), plan };
}
