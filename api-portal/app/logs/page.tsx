import type { Metadata } from "next";
import { Suspense } from "react";
import { LogsView } from "@/components/logs";
import { PortalShell } from "@/components/portal-shell";
import { requirePortalMember } from "@/lib/access";
import { loadLogs } from "@/lib/logs";

export const metadata: Metadata = { title: "Activity log" };

/** `?door=api|mcp` and `?result=failed` narrow the log; anything else shows every call. */
async function LogsPage({ searchParams }: Pick<PageProps<"/logs">, "searchParams">) {
  const member = await requirePortalMember();
  const view = await loadLogs(member.supabase, await searchParams, new Date());
  return (
    <PortalShell email={member.email} orgName={member.orgName} appUrl={member.appUrl}>
      <LogsView {...view} />
    </PortalShell>
  );
}

export default function Page({ searchParams }: PageProps<"/logs">) {
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-dvh" />}>
      <LogsPage searchParams={searchParams} />
    </Suspense>
  );
}
