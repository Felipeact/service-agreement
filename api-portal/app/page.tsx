import { Suspense } from "react";
import { Overview } from "@/components/overview";
import { PortalShell } from "@/components/portal-shell";
import { recentActivity } from "@/lib/activity";
import { requirePortalMember } from "@/lib/access";
import { summariseActivity } from "@/lib/developer";

async function OverviewPage() {
  const member = await requirePortalMember();
  const now = new Date();
  const rows = await recentActivity(member.supabase, now);
  return (
    <PortalShell email={member.email} orgName={member.orgName} appUrl={member.appUrl}>
      <Overview plan={member.plan} origin={member.appUrl} activity={rows ? summariseActivity(rows, now.getTime()) : null} />
    </PortalShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-dvh" />}>
      <OverviewPage />
    </Suspense>
  );
}
