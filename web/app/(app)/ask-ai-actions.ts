"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getContainer } from "@/composition";
import { canWriteRecords } from "@/components/records/state";
import { MAX_QUESTION_LENGTH, type AssistantReply } from "@/domain/assistant";

export type AskAiState = { ok: true; reply: AssistantReply; left: number } | { ok: false; error: string };

/** The browser reports the page it is on and the earlier turns; only their shape is used, never trusted for access. */
const inputSchema = z.object({
  question: z.string().max(MAX_QUESTION_LENGTH + 200),
  page: z.string().regex(/^\/[A-Za-z0-9/_-]{0,120}$/).catch("/"),
  history: z.string().max(80_000).catch("[]"),
});

/**
 * Ask AI (assistant door 3): one question from the signed-in member, with an optional attached equipment list (csv, xlsx, docx or
 * pdf). The model works through the same tools as the MCP endpoint, as the member: it reads, and for a member who may write records
 * it creates customers, sites, equipment and draft agreements itself, then says what it did. Signed out goes to /login.
 */
export async function askAiAction(formData: FormData): Promise<AskAiState> {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  const parsed = inputSchema.safeParse({ question: formData.get("question"), page: formData.get("page"), history: formData.get("history") ?? "[]" });
  if (!parsed.success) return { ok: false, error: "Type a question first." };
  let history: unknown = [];
  try {
    history = JSON.parse(parsed.data.history);
  } catch {
    history = [];
  }
  const file = formData.get("file");
  const attachment = file instanceof File && file.size > 0 ? { name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) } : undefined;
  return container.askAssistant({
    question: parsed.data.question,
    page: parsed.data.page,
    history,
    attachment,
    caller: { userId: member.userId, orgId: member.orgId, email: member.email, orgName: member.orgName, role: member.role, canWrite: canWriteRecords(member.role), plan: null },
  });
}
