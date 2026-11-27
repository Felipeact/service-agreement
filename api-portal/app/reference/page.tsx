import type { Metadata } from "next";
import { Suspense } from "react";
import { PortalShell } from "@/components/portal-shell";
import { ReferenceView } from "@/components/reference";
import { requirePortalMember } from "@/lib/access";
import { openApiDocument } from "@/domain/public-api";

export const metadata: Metadata = { title: "API reference" };

async function ReferencePage() {
  const member = await requirePortalMember();
  return (
    <PortalShell email={member.email} orgName={member.orgName} appUrl={member.appUrl}>
      <ReferenceView spec={openApiDocument(member.appUrl)} plan={member.plan} />
    </PortalShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div aria-busy="true" className="min-h-dvh" />}>
      <ReferencePage />
    </Suspense>
  );
}
