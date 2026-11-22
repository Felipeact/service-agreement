"use client";

import { useState, useTransition } from "react";
import type { ScopeControl, UncoveredType } from "@/domain/agreement";
import { DEFAULT_ITEM_WORDS, itemText, type ItemWords } from "@/domain/org-settings";
import { SCOPE_MESSAGES, type ScopeState } from "@/components/agreements/state";

type ScopeControlsProps = {
  controls: readonly ScopeControl[];
  uncovered: readonly UncoveredType[];
  /** Absent for a viewer: the lists show, with no buttons. */
  setExcluded?: (assetId: string, excluded: boolean) => Promise<ScopeState>;
  /** The org's item words; the default when absent. */
  words?: ItemWords;
};

const panel = "overflow-hidden rounded-panel border border-hairline bg-surface";
const heading = "border-b border-hairline bg-ground px-4 py-2 text-[13px] font-semibold";

const unitLabel = (control: ScopeControl) => [control.unitNo ?? "No unit #", control.typeModel, control.location].filter(Boolean).join(" · ");
const count = (n: number) => `${n} ${n === 1 ? "unit" : "units"}`;

/**
 * "Scope": what the agreement covers, with a way to leave one unit out without deleting it (p0-launch-fixes AC 4, 5).
 * A type comes into scope through a service line that covers it, so the types no line covers are listed with the way in.
 */
export function ScopeControls({ controls, uncovered, setExcluded, words = DEFAULT_ITEM_WORDS }: ScopeControlsProps) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  if (controls.length === 0 && uncovered.length === 0) return null;

  const types = [...new Set(controls.map((control) => control.typeName))];
  const change = (assetId: string, excluded: boolean) =>
    startTransition(async () => {
      const result = await setExcluded!(assetId, excluded);
      setMessage(result.status === "saved" ? null : result.status in SCOPE_MESSAGES ? SCOPE_MESSAGES[result.status as keyof typeof SCOPE_MESSAGES] : null);
    });

  return (
    <section aria-label="Scope" className={panel}>
      <h2 className={heading}>Scope</h2>
      <p className="border-b border-hairline px-4 py-2 text-[13px] text-ink-2">
        {itemText("The agreement covers the equipment of the types its service lines cover. Leave a unit out and it stays on the site, just not in this agreement.", words)}
      </p>
      {message && (
        <p role="alert" className="px-4 pt-2 text-[13px] font-medium text-danger">
          {message}
        </p>
      )}
      {controls.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-ink-2">{itemText("No equipment is covered until you add a service line.", words)}</p>
      ) : (
        <div className="divide-y divide-hairline">
          {types.map((typeName) => {
            const rows = controls.filter((control) => control.typeName === typeName);
            const left = rows.filter((row) => !row.excluded).length;
            return (
              <div key={typeName} className="flex flex-col">
                <p className="px-4 pt-3 text-[14px] font-medium">{`${typeName}, ${count(left)} in scope${left === rows.length ? "" : ` of ${rows.length}`}`}</p>
                <ul className="divide-y divide-hairline">
                  {rows.map((row) => (
                    <li key={row.assetId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-[13px]">
                      <span className={row.excluded ? "text-ink-2 line-through" : ""}>
                        {unitLabel(row)}
                        {row.excluded && <span className="ml-2 no-underline text-[12px] font-medium text-attention-fg">Left out</span>}
                      </span>
                      {setExcluded && (
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => change(row.assetId, !row.excluded)}
                          className="inline-flex min-h-11 items-center rounded-control px-2 font-medium text-action disabled:opacity-60 lg:min-h-[34px]"
                          aria-label={`${row.excluded ? "Include" : "Leave out"} ${unitLabel(row)}`}
                        >
                          {row.excluded ? "Include" : "Leave out"}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
      {uncovered.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-hairline bg-ground px-4 py-3 text-[13px]">
          <p className="font-medium">Not covered by any service line, so not in this agreement:</p>
          <p className="text-ink-2">{uncovered.map((type) => `${type.name} (${type.assetCount})`).join(", ")}</p>
          <p className="text-ink-2">Check the type on a service line above to include it.</p>
        </div>
      )}
    </section>
  );
}
