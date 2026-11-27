import type { Metadata } from "next";
import { Suspense } from "react";
import { McpGuide } from "@/components/mcp-guide";
import { PortalShell } from "@/components/portal-shell";
import { requirePortalMember } from "@/lib/access";

export const metadata: Metadata = { title: "Connect an AI client" };

async function McpPage() {
  const member = await requirePortalMember();
  return (
    <PortalShell email={member.email} orgName={member.orgName} appUrl={member.appUrl}>
      <McpGuide plan={member.plan} origin={member.appUrl} />
    </PortalShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-dvh" />}>
      <McpPage />
    </Suspense>
  );
}
