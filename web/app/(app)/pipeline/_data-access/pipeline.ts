import { redirect } from "next/navigation";
import type { MemberRole } from "@/application/ports";
import { getContainer } from "@/composition";
import { setupGate } from "@/domain/org-settings/setup";
import { today as businessDay } from "@/lib/business-day";

/**
 * The signed-in member's role for the Pipeline. First-login setup (first-login-setup door 1): an owner or admin of a
 * freshly provisioned org lands on /setup once. A read that fails must not take Pipeline down, so it counts as not pending.
 */
export async function pipelineMemberRole(): Promise<MemberRole | undefined> {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") return undefined;
  const pending = await container.setupPending(member.orgId).catch(() => false);
  if (setupGate(member.role, pending) === "setup") redirect("/setup");
  return member.role;
}

/** Expiring soon in full: the agreements ending in the renewal window, and the business day it was read on. */
export async function loadExpiring() {
  const { pipelineExpiring, clock } = await getContainer();
  const today = businessDay(clock.now());
  return { rows: await pipelineExpiring(today), today };
}

/** The board: every agreement by stage, the Expiring soon column, and the newest equipment imports under it. */
export async function loadBoard() {
  const { pipelineBoard, pipelineExpiring, listImportHistory, clock } = await getContainer();
  const today = businessDay(clock.now());
  const [cards, expiring, imports] = await Promise.all([pipelineBoard(), pipelineExpiring(today), listImportHistory({})]);
  return { cards, expiring, imports, today };
}
