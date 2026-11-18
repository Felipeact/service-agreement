"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { MAX_UNITS_PER_TYPE } from "@/domain/agreement/new-agreement";
import { TRADE_LABELS, TRADES, tradeOf, type Trade } from "@/domain/agreement/recommend";
import { DEFAULT_ITEM_WORDS, itemText, type ItemWords } from "@/domain/org-settings";

export type PickableType = { id: string; code: string; name: string; pack: string | null };

type Props = {
  types: PickableType[];
  /** Units chosen per type id; a type at 0 is not chosen. */
  counts: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  disabled?: boolean;
  words?: ItemWords;
};

/**
 * Equipment chosen by hand when the customer has no list to upload: the org's types grouped by trade (heating and cooling,
 * refrigeration, plumbing, electrical and the rest), a search, and a stepper per type. Only the trades the catalog holds are offered.
 */
export function EquipmentPicker({ types, counts, onChange, disabled = false, words = DEFAULT_ITEM_WORDS }: Props) {
  const [query, setQuery] = useState("");
  const [trade, setTrade] = useState<Trade | "all">("all");

  const byTrade = useMemo(() => {
    const groups = new Map<Trade, PickableType[]>();
    for (const type of types) {
      const key = tradeOf(type);
      groups.set(key, [...(groups.get(key) ?? []), type]);
    }
    return TRADES.filter((key) => groups.has(key)).map((key) => ({ trade: key, types: groups.get(key)!.sort((a, b) => a.name.localeCompare(b.name)) }));
  }, [types]);

  const needle = query.trim().toLowerCase();
  const shown = byTrade
    .filter((group) => trade === "all" || group.trade === trade)
    .map((group) => ({ ...group, types: group.types.filter((type) => !needle || type.name.toLowerCase().includes(needle) || type.code.toLowerCase().includes(needle)) }))
    .filter((group) => group.types.length > 0);

  const chosen = Object.entries(counts).filter(([, count]) => count > 0);
  const units = chosen.reduce((sum, [, count]) => sum + count, 0);

  const set = (id: string, count: number) => {
    const next = { ...counts };
    if (count <= 0) delete next[id];
    else next[id] = Math.min(MAX_UNITS_PER_TYPE, count);
    onChange(next);
  };

  if (types.length === 0) {
    return <p className="rounded-control bg-ground px-3 py-3 text-[13px] text-ink-2">{itemText("Your equipment catalog is empty. Upload a list instead, or add equipment to the site later.", words)}</p>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">{itemText("Search equipment types", words)}</span>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-ink-2" />
          <input
            type="search"
            value={query}
            disabled={disabled}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search types by name or code"
            className="h-11 w-full rounded-control border border-field bg-surface pr-3 pl-8 text-[13px] placeholder:text-ink-2 lg:h-[34px]"
          />
        </label>
      </div>
      {byTrade.length > 1 && (
        <div role="group" aria-label="Trade" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible">
          {(["all", ...byTrade.map((group) => group.trade)] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={trade === key}
              disabled={disabled}
              onClick={() => setTrade(key)}
              className="h-11 shrink-0 rounded-full border border-hairline bg-surface px-3 text-[12px] font-semibold text-ink-2 transition-colors duration-150 hover:bg-ground aria-pressed:border-action aria-pressed:bg-action-tint aria-pressed:text-action lg:h-8"
            >
              {key === "all" ? "All trades" : TRADE_LABELS[key]}
            </button>
          ))}
        </div>
      )}
      <div className="max-h-[17rem] overflow-y-auto overscroll-contain rounded-control border border-hairline">
        {shown.length === 0 ? (
          <p className="px-3 py-6 text-center text-[13px] text-ink-2">{`No type matches "${query.trim()}"`}</p>
        ) : (
          shown.map((group) => (
            <div key={group.trade} role="group" aria-label={TRADE_LABELS[group.trade]}>
              <p className="sticky top-0 z-10 border-b border-hairline bg-ground px-3 py-1.5 text-[11px] font-semibold text-ink-2">{TRADE_LABELS[group.trade]}</p>
              <ul className="divide-y divide-hairline">
                {group.types.map((type) => {
                  const count = counts[type.id] ?? 0;
                  return (
                    <li key={type.id} className={`flex items-center justify-between gap-3 px-3 py-1 ${count > 0 ? "bg-action-tint/50" : ""}`}>
                      <span className="min-w-0 text-[13px]">
                        <span className={count > 0 ? "font-semibold" : ""}>{type.name}</span>
                        {type.name.toUpperCase() !== type.code.replaceAll("_", " ") && <span className="ml-1.5 text-[11px] text-ink-2">{type.code}</span>}
                      </span>
                      <span className="flex shrink-0 items-center">
                        {count > 0 && (
                          <button type="button" disabled={disabled} onClick={() => set(type.id, count - 1)} aria-label={`One fewer ${type.name}`} className={stepper}>
                            <Icon name="minus" className="size-4" />
                          </button>
                        )}
                        {count > 0 && (
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={MAX_UNITS_PER_TYPE}
                            value={count}
                            disabled={disabled}
                            aria-label={`${type.name} units`}
                            onChange={(event) => set(type.id, Math.max(0, Math.floor(Number(event.target.value) || 0)))}
                            className="h-9 w-10 rounded-control border border-field bg-surface text-center text-[13px] font-semibold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        )}
                        <button
                          type="button"
                          disabled={disabled || count >= MAX_UNITS_PER_TYPE}
                          onClick={() => set(type.id, count + 1)}
                          aria-label={count > 0 ? `One more ${type.name}` : `Add ${type.name}`}
                          className={count > 0 ? stepper : `${stepper} text-action`}
                        >
                          <Icon name="plus" className="size-4" />
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
      <p role="status" aria-live="polite" className="text-[12px] text-ink-2">
        {units === 0 ? "Nothing chosen yet. Tap + beside each type on site." : `${units} ${units === 1 ? "unit" : "units"} across ${chosen.length} ${chosen.length === 1 ? "type" : "types"}. Service lines are recommended from these.`}
      </p>
    </div>
  );
}

const stepper =
  "inline-flex size-11 items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-surface hover:text-ink disabled:opacity-40 lg:size-9";
