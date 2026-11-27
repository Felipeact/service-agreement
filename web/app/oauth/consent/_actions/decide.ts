"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getContainer } from "@/composition";

const Decision = z.object({ authorizationId: z.string().min(8).max(200).regex(/^[A-Za-z0-9._-]+$/), decision: z.enum(["approve", "deny"]) });

export type DecideState = { ok: true; url: string } | { ok: false };

/**
 * The member's answer to an AI client's request. Only a signed-in member can answer (a signed-out visitor goes to sign-in), the input
 * is validated, and Supabase Auth itself matches the request to this member, so one member cannot answer another's request. It answers
 * the address to send the member on to; the page navigates there itself, because the CSP's `form-action 'self'` would refuse a
 * form that ends on the AI client's own address.
 */
export async function decideConsentAction(authorizationId: string, decision: "approve" | "deny"): Promise<DecideState> {
  const parsed = Decision.safeParse({ authorizationId, decision });
  if (!parsed.success) return { ok: false };
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  const url = await container.oauthConsent.decide(parsed.data.authorizationId, parsed.data.decision === "approve");
  return url ? { ok: true, url } : { ok: false };
}
