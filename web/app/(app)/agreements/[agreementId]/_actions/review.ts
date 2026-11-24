"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getContainer } from "@/composition";
import type { ApplyReviewState, ReviewState } from "@/components/agreements/state";
import { canWriteRecords } from "@/components/records/state";

const agreementIdSchema = z.uuid();

/** The lines "Apply all" sends back: the proposal as it was shown. The use case checks the types against the site again. */
const proposalSchema = z
  .array(
    z.object({
      description: z.string().trim().min(1).max(200),
      visitMonths: z.array(z.number().int().min(1).max(12)).min(1).max(12),
      costPerVisitCents: z.number().int().min(0).max(99_999_999),
      assetTypeIds: z.array(z.uuid()).min(1).max(100),
    }),
  )
  .min(1)
  .max(50);

/** The container, or `null` when the member may not write agreements. Signed out goes to /login. */
async function writer() {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  return canWriteRecords(member.role) ? container : null;
}

/** Asks the AI for the agreement's suggested lines and what applying them would change. Saves nothing. */
export async function reviewAgreementAction(agreementId: string): Promise<ReviewState> {
  const container = await writer();
  if (!container) return { status: "forbidden" };
  if (!agreementIdSchema.safeParse(agreementId).success) return { status: "not_found" };
  const result = await container.reviewAgreement(agreementId);
  if (!result.ok) return { status: result.code };
  return {
    status: "ready",
    source: result.source,
    summary: result.summary,
    proposal: result.proposal.map(({ description, visitMonths, costPerVisitCents, assetTypeIds }) => ({ description, visitMonths, costPerVisitCents, assetTypeIds })),
    diff: result.diff,
  };
}

/** Replaces the draft's lines with the reviewed proposal ("Apply all"). */
export async function applyReviewAction(agreementId: string, proposal: unknown): Promise<ApplyReviewState> {
  const container = await writer();
  if (!container) return { status: "forbidden" };
  if (!agreementIdSchema.safeParse(agreementId).success) return { status: "not_found" };
  const parsed = proposalSchema.safeParse(proposal);
  if (!parsed.success) return { status: "invalid" };
  const lines = parsed.data.map((line) => ({ ...line, visitMonths: [...new Set(line.visitMonths)].sort((a, b) => a - b), assetTypeIds: [...new Set(line.assetTypeIds)] }));
  const result = await container.applyServiceLines(agreementId, lines);
  revalidatePath(`/agreements/${agreementId}`);
  revalidatePath("/pipeline");
  return result.ok ? { status: "applied", lines: result.lines } : { status: result.code };
}
