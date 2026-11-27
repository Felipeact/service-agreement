import type { SupabaseClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasDeveloperAccess } from "@/domain/billing/plan-access";
import { appUrl } from "./env";
import { createSupabase } from "./supabase";

export type PortalMember = { supabase: SupabaseClient; userId: string; email: string; orgName: string; role: "owner" | "admin"; plan: string; appUrl: string };

/**
 * Who may use the portal: a signed-in owner or admin whose plan includes the API or MCP. Signed out goes to the app's sign-in (the
 * session cookie is shared with the app); anyone else goes back to the app's Pipeline, so the portal is never shown to a company
 * that cannot use it. Every page calls this. The checks use the visitor's own session, so row-level security still decides what exists.
 */
export async function requirePortalMember(): Promise<PortalMember> {
  const app = appUrl();
  const supabase = await createSupabase();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect(`${app}/login`);

  const { data: rows, error } = await supabase.from("memberships").select("org_id, role, orgs(name)").eq("user_id", claims.sub).order("created_at", { ascending: true }).limit(1);
  const row = rows?.[0] as { role: string; orgs: { name: string } | { name: string }[] | null } | undefined;
  if (error || !row) redirect(`${app}/pipeline`);
  const role = row.role;
  const { data: plan } = await supabase.rpc("org_plan");
  if ((role !== "owner" && role !== "admin") || typeof plan !== "string" || !hasDeveloperAccess(plan)) redirect(`${app}/pipeline`);
  const org = Array.isArray(row.orgs) ? row.orgs[0] : row.orgs;
  return { supabase, userId: claims.sub, email: typeof claims.email === "string" ? claims.email : "", orgName: org?.name ?? "", role, plan, appUrl: app };
}

/** The address the portal's own pages are served from, for the examples; from the request, not from a setting. */
export async function portalOrigin(): Promise<string> {
  const sent = await headers();
  const host = sent.get("x-forwarded-host") ?? sent.get("host") ?? "localhost:3001";
  const proto = sent.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
