"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { useItemWords } from "@/components/shell/item-words";
import { itemText } from "@/domain/org-settings";
import type { GenerateLinesState } from "@/components/agreements/state";

const MESSAGE: Record<GenerateLinesState["status"], string> = {
  idle: "",
  generated: "",
  forbidden: "You cannot change this agreement.",
  not_found: "This agreement could not be found.",
  locked: "This agreement can no longer be edited.",
  unavailable: "Some lines could not be added. Press the button again to add the rest.",
};

/**
 * Builds the service lines from the equipment on the site with the standard plan: one line per frequency (monthly, quarterly,
 * semi-annual, annual), with its visits and a suggested price per visit the contractor can change. The page refreshes itself after the action, so the lines, the visit schedule and the service
 * included list appear without a reload.
 */
export function GenerateLinesControl({ action, uncoveredCount }: { action: () => Promise<GenerateLinesState>; uncoveredCount: number }) {
  const [state, setState] = useState<GenerateLinesState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const words = useItemWords();

  function handleGenerate() {
    startTransition(async () => setState(await action().catch(() => ({ status: "unavailable" }) as const)));
  }

  return (
    <div className="flex flex-col gap-2 border-t border-hairline px-4 py-3">
      <p className="text-[13px] text-ink-2">
        {itemText(
          `${uncoveredCount} equipment ${uncoveredCount === 1 ? "type has" : "types have"} no service line. Build them from the site's equipment, grouped by how often each is serviced, with visits and a suggested price.`,
          words,
        )}
      </p>
      <div>
        <Button variant="primary" onClick={handleGenerate} disabled={pending}>
          {pending ? "Building…" : "Build service lines"}
        </Button>
      </div>
      {state.status === "generated" && (
        <p role="status" className="text-[13px] text-ink-2">
          {state.added === 0 ? itemText("Every equipment type already has a line.", words) : `Added ${state.added} service ${state.added === 1 ? "line" : "lines"} with suggested prices. Check them before sending.`}
        </p>
      )}
      {MESSAGE[state.status] && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {MESSAGE[state.status]}
        </p>
      )}
    </div>
  );
}
