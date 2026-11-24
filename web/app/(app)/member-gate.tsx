import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { NoWorkspace, type NoWorkspaceState } from "@/components/shell/no-workspace";
import { getContainer } from "@/composition";
import { isClosedStage, needsFollowUp } from "@/domain/pipeline";
import { planDisplayName } from "@/domain/billing/plan-limits";
import { reportAccess } from "@/domain/reports";
import { canWriteRecords } from "@/components/records/state";
import { signOutAction } from "./actions";
import { NewAgreementLauncher } from "./new-agreement-launcher";
import { AskAi } from "@/components/shell/ask-ai";
import { askAiAction } from "./ask-ai-actions";
import { createAgreementAction, generateServiceLinesAction } from "./agreement-actions";

/** Checks the session again behind the proxy, which a matcher change could bypass. Render it inside Suspense (door 6). */
export async function MemberGate({ children }: { children: ReactNode }) {
  const { currentMember, pipelineBoard, getItemWords, workspaceState, loadBillingUsage } = await getContainer();
  const member = await currentMember();

  if (member.status === "signed_out") redirect("/login");
  if (member.status === "no_membership") {
    // Only a person with no membership asks. A read that fails leaves today's "No workspace yet" copy (workspace-pending-state AC 13).
    let state: NoWorkspaceState = "none";
    try {
      state = await workspaceState();
    } catch {
      // keep "none"
    }
    return <NoWorkspace email={member.email} signOut={signOutAction} state={state} />;
  }

  // The bell counts the agreements that need the estimator, and Pipeline's badge the open ones. A board that cannot be read must not take the shell down with it.
  const cards = await pipelineBoard().catch(() => []);
  const followUps = cards.filter(needsFollowUp).length;
  const openCount = cards.filter((card) => !isClosedStage(card.stage)).length;
  const words = await getItemWords(member.orgId);
  // The plan card is for owners and admins (the reader returns null for everyone else); a failed read leaves it out.
  const usage = await loadBillingUsage({ orgId: member.orgId, role: member.billingRole ?? member.role }).catch(() => null);
  const plan =
    usage && usage.plan && usage.liveAgreements.limit !== null
      ? { planName: planDisplayName(usage.plan), used: usage.totalAgreements ?? usage.liveAgreements.used, limit: usage.liveAgreements.limit, canManage: true }
      : null;

  return (
    <AppShell orgName={member.orgName} email={member.email} signOut={signOutAction} followUps={followUps} askAi={<AskAi canAct={canWriteRecords(member.role)} actions={{ ask: askAiAction, createAgreement: createAgreementAction, generateLines: generateServiceLinesAction }} />} newAgreement={canWriteRecords(member.role) ? <NewAgreementLauncher /> : undefined} words={words} role={member.billingRole ?? member.role} plan={plan} counts={{ "/pipeline": openCount }} reports={reportAccess(member.billingRole ?? member.role) !== "none"} frozen={member.frozen ? { canRenew: member.billingRole === "owner" || member.billingRole === "admin" } : undefined}>
      {children}
    </AppShell>
  );
}
