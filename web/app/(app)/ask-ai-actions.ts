"use server";

import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { canWriteRecords } from "@/components/records/state";
import type { AssistantReply } from "@/domain/assistant";

export type AskAiState = { ok: true; reply: AssistantReply; left: number } | { ok: false; error: string };

/**
 * Ask AI (assistant door 3): answers one question for the signed-in member from their own agreements and sites and the page they
 * are on. Signed out goes to /login. The answer may offer one action; it is never run here, the member confirms it and the
 * button calls the same action the page's own button does.
 */
export async function askAiAction(question: string, page: string, history: unknown): Promise<AskAiState> {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  // The page is a path the browser reports; only its shape is used, never trusted for access.
  const safePage = typeof page === "string" && /^\/[A-Za-z0-9/_-]{0,120}$/.test(page) ? page : "/";
  return container.askAssistant({ question, page: safePage, history, orgId: member.orgId, canAct: canWriteRecords(member.role) });
}
