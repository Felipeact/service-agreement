"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { GenerateLinesState } from "@/components/agreements/state";
import { DEFAULT_ITEM_WORDS, itemText, type ItemWords } from "@/domain/org-settings";

const MESSAGE: Record<GenerateLinesState["status"], string> = {
  idle: "",
  generated: "",
  forbidden: "You cannot change this agreement.",
  not_found: "This agreement could not be found.",
  locked: "This agreement can no longer be edited.",
  unavailable: "Some lines could not be added. Press the button again to add the rest.",
};

/**
 * Builds the service lines from the equipment on the site: one per equipment type, with its best months. Prices stay at $0 for
 * the contractor to fill in. The page refreshes itself after the action, so the lines, the visit schedule and the service
 * included list appear without a reload. Copy is spoken in the org's item words (`words`, "equipment" by default).
 */
export function GenerateLinesControl({
  action,
  uncoveredCount,
  words = DEFAULT_ITEM_WORDS,
}: {
  action: () => Promise<GenerateLinesState>;
  uncoveredCount: number;
  words?: ItemWords;
}) {
  const [state, setState] = useState<GenerateLinesState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  function handleGenerate() {
    startTransition(async () => setState(await action().catch(() => ({ status: "unavailable" }) as const)));
  }

  return (
    <div className="flex flex-col gap-2 border-t border-hairline px-4 py-3">
      <p className="text-[13px] text-ink-2">
        {itemText(`${uncoveredCount} equipment ${uncoveredCount === 1 ? "type has" : "types have"} no service line. Build them from the site's equipment, with the best months for each.`, words)}
      </p>
      <div>
        <Button variant="primary" onClick={handleGenerate} disabled={pending}>
          {pending ? "Building…" : "Build service lines"}
        </Button>
      </div>
      {state.status === "generated" && (
        <p role="status" className="text-[13px] text-ink-2">
          {state.added === 0 ? itemText("Every equipment type already has a line.", words) : `Added ${state.added} service ${state.added === 1 ? "line" : "lines"}. Set the price per visit on each.`}
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
