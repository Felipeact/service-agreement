"use client";

import { useState, useTransition } from "react";
import { decideConsentAction } from "../_actions/decide";

/** Allow and Cancel. On an answer the browser is sent on to the AI client's address, which Supabase Auth supplies. */
export function ConsentButtons({ authorizationId, clientName }: { authorizationId: string; clientName: string }) {
  const [isPending, startTransition] = useTransition();
  const [hasFailed, setHasFailed] = useState(false);

  function handleDecide(decision: "approve" | "deny") {
    setHasFailed(false);
    startTransition(async () => {
      const result = await decideConsentAction(authorizationId, decision).catch(() => ({ ok: false }) as const);
      if (result.ok) window.location.assign(result.url);
      else setHasFailed(true);
    });
  }

  return (
    <>
      {hasFailed && (
        <p role="alert" className="rounded-control bg-danger-tint px-3 py-2 text-[13px] text-danger">
          That did not work. Try again, or start the connection again from {clientName}.
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" disabled={isPending} onClick={() => handleDecide("deny")} className="inline-flex min-h-11 items-center justify-center rounded-control border border-hairline bg-surface px-5 text-[14px] font-semibold text-ink hover:bg-board disabled:opacity-60">
          Cancel
        </button>
        <button type="button" disabled={isPending} onClick={() => handleDecide("approve")} className="inline-flex min-h-11 items-center justify-center rounded-control bg-action px-5 text-[14px] font-semibold text-white hover:bg-action-hover active:bg-action-press disabled:opacity-60">
          Allow
        </button>
      </div>
    </>
  );
}
