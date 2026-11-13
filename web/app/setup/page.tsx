import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SetupView } from "@/components/setup/setup-view";
import { getContainer } from "@/composition";
import { groupSetupCatalog, setupEntry } from "@/domain/org-settings/setup";
import { prepareLogoUpload } from "@/app/logo-upload";
import { setupAction } from "./actions";
import { acceptDraftAction, draftCatalogAction } from "./draft-actions";

export const metadata: Metadata = { title: "Set up your workspace" };

/** Read at request time: who is asking, whether their org's setup is pending, and what the screen shows. */
export async function SetupForRequest() {
  const { currentMember, setupPending, getOrgSettings, setupCatalog, getItemWords, logo } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect(member.status === "signed_out" ? "/login" : "/pipeline");

  const entry = setupEntry({ status: "member", role: member.role }, await setupPending(member.orgId));
  if (entry.to !== "render") redirect(entry.to);

  const [settings, types, words, logoPath] = await Promise.all([getOrgSettings(member.orgId), setupCatalog(), getItemWords(member.orgId), logo.current(member.orgId)]);
  if (!settings) redirect("/pipeline");
  return <SetupView settings={settings} groups={groupSetupCatalog(types, words)} words={words} action={setupAction} logoPath={logoPath ?? ""} prepareLogo={prepareLogoUpload} draft={{ draftAction: draftCatalogAction, acceptAction: acceptDraftAction }} />;
}

export default function SetupPage() {
  return (
    <main>
      <Suspense
        fallback={
          <p role="status" className="px-4 py-12 text-[13px] text-ink-2">
            Loading…
          </p>
        }
      >
        <SetupForRequest />
      </Suspense>
    </main>
  );
}
