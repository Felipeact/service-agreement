import type { Metadata } from "next";
import { Suspense } from "react";
import { prepareLogoUpload } from "@/app/logo-upload";
import { setupAction } from "./actions";
import { SetupView } from "./_components/content";
import { loadSetup } from "./_data-access/setup";
import { acceptDraftAction, draftCatalogAction } from "./draft-actions";

export const metadata: Metadata = { title: "Set up your workspace" };

/** Read at request time: who is asking, whether their org's setup is pending, and what the screen shows. */
export async function SetupForRequest() {
  const { settings, groups, words, logoPath } = await loadSetup();
  return (
    <SetupView
      settings={settings}
      groups={groups}
      words={words}
      action={setupAction}
      logoPath={logoPath}
      prepareLogo={prepareLogoUpload}
      draft={{ draftAction: draftCatalogAction, acceptAction: acceptDraftAction }}
    />
  );
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
