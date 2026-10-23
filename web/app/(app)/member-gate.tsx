import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { NoWorkspace } from "@/components/shell/no-workspace";
import { getContainer } from "@/composition";
import { signOutAction } from "./actions";

/** Checks the session again behind the proxy, which a matcher change could bypass. Render it inside Suspense (door 6). */
export async function MemberGate({ children }: { children: ReactNode }) {
  const { currentMember } = await getContainer();
  const member = await currentMember();

  if (member.status === "signed_out") redirect("/login");
  if (member.status === "no_membership") return <NoWorkspace email={member.email} signOut={signOutAction} />;

  return (
    <AppShell orgName={member.orgName} email={member.email} signOut={signOutAction}>
      {children}
    </AppShell>
  );
}
