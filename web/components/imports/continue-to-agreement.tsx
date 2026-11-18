"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * "Continue to the agreement" after a list is added to the site: the agreement first gets the recommended service lines for
 * the new equipment (recommended-lines), then opens. A failure to recommend still opens it; the agreement offers the
 * recommendation again from its own page.
 */
export function ContinueToAgreement({ agreementId, recommend, children }: { agreementId: string; recommend: () => Promise<{ status: string }>; children: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await recommend().catch(() => null);
          router.push(`/agreements/${agreementId}`);
        })
      }
      className="inline-flex min-h-11 shrink-0 items-center font-semibold text-action disabled:opacity-60 lg:min-h-0"
    >
      {pending ? "Recommending service lines…" : children}
    </button>
  );
}
