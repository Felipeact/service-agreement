import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { NoWorkspace, type NoWorkspaceState } from "@/components/shell/no-workspace";
import { getContainer } from "@/composition";
import { needsFollowUp } from "@/domain/pipeline";
import { signOutAction } from "./actions";

const TODAY = new Intl.DateTimeFormat("en-CA", { weekday: "long", month: "long", day: "numeric", timeZone: "America/Vancouver" });

/** Checks the session again behind the proxy, which a matcher change could bypass. Render it inside Suspense (door 6). */
export async function MemberGate({ children }: { children: ReactNode }) {
  const { currentMember, pipelineBoard, clock, getItemWords, workspaceState } = await getContainer();
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

  // The bell counts the agreements that need the estimator. A board that cannot be read must not take the shell down with it.
  const followUps = await pipelineBoard().then(
    (cards) => cards.filter(needsFollowUp).length,
    () => 0,
  );
  const words = await getItemWords(member.orgId);

  return (
    <AppShell orgName={member.orgName} email={member.email} signOut={signOutAction} followUps={followUps} todayLabel={TODAY.format(clock.now())} words={words} frozen={member.frozen ? { canRenew: member.billingRole === "owner" || member.billingRole === "admin" } : undefined}>
      {children}
    </AppShell>
  );
}
