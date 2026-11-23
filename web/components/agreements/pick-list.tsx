"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import type { AssetTypeOption } from "@/application/ports";
import { Button } from "@/components/ui/button";
import { useItemWords } from "@/components/shell/item-words";
import { itemText } from "@/domain/org-settings";

export type PickedCounts = Record<string, number>;

/** How many units are picked in all. */
export const pickedTotal = (picked: PickedCounts) => Object.values(picked).reduce((sum, quantity) => sum + quantity, 0);

/** The picked types as the add-equipment action takes them. */
export const pickedItems = (picked: PickedCounts) =>
  Object.entries(picked)
    .filter(([, quantity]) => quantity > 0)
    .map(([assetTypeId, quantity]) => ({ assetTypeId, quantity }));

const STEP =
  "inline-flex size-11 items-center justify-center rounded-control border border-hairline bg-surface text-ink-2 transition-colors duration-150 hover:bg-board hover:text-ink disabled:opacity-40 lg:size-8";

/** "Pick by hand": every equipment type the org services with a stepper for how many are on site, and a Reset list. */
export function EquipmentPicker({
  types,
  picked,
  onChange,
  disabled,
}: {
  types: AssetTypeOption[];
  picked: PickedCounts;
  onChange: (next: PickedCounts) => void;
  disabled?: boolean;
}) {
  const words = useItemWords();
  const total = pickedTotal(picked);
  const set = (id: string, quantity: number) => {
    const next = { ...picked };
    if (quantity <= 0) delete next[id];
    else next[id] = Math.min(99, quantity);
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 text-[13px]">
        <span className="font-semibold text-ink">{total === 0 ? "No units selected" : `${total} ${total === 1 ? "unit" : "units"} selected`}</span>
        <Button type="button" onClick={() => onChange({})} disabled={disabled || total === 0}>
          Reset list
        </Button>
      </div>
      <ul aria-label={itemText("Equipment types", words)} className="flex max-h-60 flex-col divide-y divide-hairline overflow-y-auto rounded-control border border-hairline bg-surface">
        {types.map((type) => {
          const quantity = picked[type.id] ?? 0;
          return (
            <li key={type.id} className="flex min-h-11 items-center justify-between gap-3 px-3 py-1.5">
              <span className="min-w-0 text-[13px]">
                <span className={quantity > 0 ? "font-semibold text-ink" : "text-ink"}>{type.name}</span>
                {quantity > 0 && <span className="ml-2 text-[12px] text-action">Qty: {quantity}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                {quantity > 0 && (
                  <>
                    <button type="button" aria-label={`Fewer ${type.name}`} disabled={disabled} onClick={() => set(type.id, quantity - 1)} className={STEP}>
                      <MinusIcon aria-hidden="true" className="size-3.5" />
                    </button>
                    <span aria-hidden="true" className="w-6 text-center text-[13px] font-semibold tabular-nums">
                      {quantity}
                    </span>
                  </>
                )}
                <button type="button" aria-label={`More ${type.name}`} disabled={disabled || quantity >= 99} onClick={() => set(type.id, quantity + 1)} className={STEP}>
                  <PlusIcon aria-hidden="true" className="size-3.5" />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-[12px] text-ink-2">{itemText("Tap + beside each equipment type on site, or adjust the quantities.", words)}</p>
    </div>
  );
}
