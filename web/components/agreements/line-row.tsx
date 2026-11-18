"use client";

import { useActionState, useState } from "react";
import type { ServiceLineView } from "@/application/ports";
import { monthsLabel, type EquipmentChoice } from "@/domain/agreement";
import { Button } from "@/components/ui/button";
import { formatCadExact } from "@/lib/money";
import { DEFAULT_ITEM_WORDS, itemText, type ItemWords } from "@/domain/org-settings";
import { LineFormControl } from "./line-form";
import { messageFor, type KeepState, type LineState } from "./state";
import { Icon } from "@/components/ui/icons";

type RemovePromptProps = {
  description: string;
  confirming: boolean;
  pending: boolean;
  state: LineState;
  onStart?: () => void;
  onCancel?: () => void;
  /** The remove action, bound to the line; absent in tests that only render markup. */
  action?: () => void;
};

/** Two steps: "Remove" only asks, and the line is deleted only by the second "Remove". */
export function RemovePrompt({ description, confirming, pending, state, onStart, onCancel, action }: RemovePromptProps) {
  const message = messageFor(state.status);
  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <form action={action} className="flex flex-col gap-2">
          <p className="text-[13px] font-medium text-ink">{`Remove ${description}?`}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="danger" disabled={pending}>
              Remove
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div>
          <Button onClick={onStart}>Remove</Button>
        </div>
      )}
      {message && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {message}
        </p>
      )}
    </div>
  );
}

type LineRowProps = {
  line: ServiceLineView;
  /** The types the line's edit form offers. */
  choices?: EquipmentChoice[];
  /** Present for a writer on an editable version only. */
  actions?: { update: (formData: FormData) => Promise<LineState>; remove: () => Promise<LineState>; keep?: () => Promise<KeepState> };
  words?: ItemWords;
};

/** Dollars as the edit form shows them: 89250 -> "892.50". */
const dollars = (cents: number) => (cents / 100).toFixed(2);

/** The covered types' names, by name and comma-separated (cadence AC 14). */
const equipmentLabel = (types: { name: string }[]) =>
  types
    .map((type) => type.name)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" }))
    .join(", ");

/** `Mar, Jun, Sep, Dec · 4 visits/yr` (cadence AC 7). */
export const cadenceLabel = (months: number[]) => `${monthsLabel(months)} · ${months.length} ${months.length === 1 ? "visit" : "visits"}/yr`;

/**
 * One line: description with its months and covered equipment, visits, cost per visit and annual amount; a writer
 * edits or removes it in place.
 */
export function LineRow({ line, choices = [], actions, words = DEFAULT_ITEM_WORDS }: LineRowProps) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [state, removeAction, pending] = useActionState<LineState>(
    async () => (actions ? actions.remove() : { status: "forbidden" }),
    { status: "idle" },
  );

  if (editing && actions) {
    return (
      <li className="px-4 py-3">
        <LineFormControl
          idPrefix={`line-${line.id}`}
          initial={{
            description: line.description,
            visitMonths: line.visitMonths.map(String),
            costPerVisit: dollars(line.costPerVisitCents),
            assetTypeIds: line.equipment.map((type) => type.id),
          }}
          choices={choices}
          words={words}
          submitLabel="Save"
          action={actions.update}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li data-line={line.position} data-recommended={line.recommended ? "true" : undefined} className={`flex flex-col gap-3 px-4 py-4 text-[13px] ${line.recommended ? "bg-action-tint/40" : ""}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[14px] font-semibold break-words">{line.description}</span>
            {line.recommended && <RecommendedTag />}
          </div>
          {line.visitMonths.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <MonthStrip months={line.visitMonths} />
              <span className="text-ink-2">{cadenceLabel(line.visitMonths)}</span>
            </div>
          )}
          {line.equipment.length > 0 && <span className="text-ink-2 break-words">{equipmentLabel(line.equipment)}</span>}
        </div>
        <dl className="grid shrink-0 grid-cols-3 gap-x-4 rounded-control bg-ground px-3 py-2 md:min-w-[19rem] md:bg-transparent md:p-0 md:text-right">
          <div className="flex flex-col">
            <dt className="text-[11px] font-semibold text-ink-2">Visits per year</dt>
            <dd>{line.visitsPerYear}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-[11px] font-semibold text-ink-2">Per visit</dt>
            <dd>{formatCadExact(line.costPerVisitCents)}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-[11px] font-semibold text-ink-2">Per year</dt>
            <dd className="font-semibold">{formatCadExact(line.annualCents)}</dd>
          </div>
        </dl>
      </div>
      {line.recommended && actions && (
        <p className="text-[12px] text-ink-2">{itemText("Recommended from the equipment on site, with a typical price. Keep it as it is or edit it before sending.", words)}</p>
      )}
      {actions && (
        <div className="flex flex-wrap items-start gap-2">
          {line.recommended && actions.keep && !confirming && <KeepButton keep={actions.keep} />}
          {!confirming && <Button onClick={() => setEditing(true)}>Edit</Button>}
          <RemovePrompt
            description={line.description}
            confirming={confirming}
            pending={pending}
            state={state}
            onStart={() => setConfirming(true)}
            onCancel={() => setConfirming(false)}
            action={removeAction}
          />
        </div>
      )}
    </li>
  );
}

/** The tag a line carries while it is still the app's suggestion. */
export function RecommendedTag() {
  return (
    <span data-recommended-tag className="inline-flex items-center gap-1 rounded-full bg-action-tint px-2 py-0.5 text-[11px] leading-4 font-semibold text-action ring-1 ring-inset ring-action/20">
      <Icon name="spark" className="size-3" />
      Recommended
    </span>
  );
}

/** Twelve small cells, January first, the visited months filled: the cadence at a glance, with the words beside it. */
export function MonthStrip({ months }: { months: number[] }) {
  const visited = new Set(months);
  return (
    <span aria-hidden="true" className="inline-flex gap-[3px]">
      {MONTH_INITIALS.map((initial, index) => (
        <span
          key={index}
          className={`flex size-[18px] items-center justify-center rounded-[4px] text-[10px] leading-none font-semibold ${visited.has(index + 1) ? "bg-action text-surface" : "bg-board text-ink-2"}`}
        >
          {initial}
        </span>
      ))}
    </span>
  );
}

const MONTH_INITIALS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

function KeepButton({ keep }: { keep: () => Promise<KeepState> }) {
  const [state, action, pending] = useActionState<KeepState>(keep, { status: "idle" });
  const message = state.status !== "idle" && state.status !== "kept" ? messageFor(state.status) : null;
  return (
    <form action={action} className="flex flex-col gap-1">
      <Button type="submit" variant="primary" disabled={pending}>
        <Icon name="check" className="size-4" />
        Keep
      </Button>
      {message && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {message}
        </p>
      )}
    </form>
  );
}
