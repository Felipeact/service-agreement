"use client";

import { useActionState, useState } from "react";
import type { ServiceLineView } from "@/application/ports";
import { monthsLabel, type EquipmentChoice } from "@/domain/agreement";
import { Button } from "@/components/ui/button";
import { formatCadExact } from "@/lib/money";
import { LineFormControl } from "./line-form";
import { messageFor, type LineState } from "./state";

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
  actions?: { update: (formData: FormData) => Promise<LineState>; remove: () => Promise<LineState> };
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
export const cadenceLabel = (months: number[]) => `${monthsLabel(months)} · ${months.length} visits/yr`;

/**
 * One line: description with its months and covered equipment, visits, cost per visit and annual amount; a writer
 * edits or removes it in place.
 */
export function LineRow({ line, choices = [], actions }: LineRowProps) {
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
          submitLabel="Save"
          action={actions.update}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </li>
    );
  }

  return (
    <li data-line={line.position} className="flex flex-col gap-2 px-4 py-3 text-[13px]">
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 md:grid-cols-[minmax(0,3fr)_6rem_8rem_8rem] md:items-center">
        <span className="col-span-2 flex min-w-0 flex-col gap-0.5 md:col-span-1">
          <span className="font-semibold break-words">{line.description}</span>
          {line.visitMonths.length > 0 && <span className="text-ink-2">{cadenceLabel(line.visitMonths)}</span>}
          {line.equipment.length > 0 && <span className="text-ink-2 break-words">{equipmentLabel(line.equipment)}</span>}
        </span>
        <span className="text-ink-2">
          <span className="md:hidden">Visits per year: </span>
          {line.visitsPerYear}
        </span>
        <span className="text-ink-2 md:text-right">
          <span className="md:hidden">Per visit: </span>
          {formatCadExact(line.costPerVisitCents)}
        </span>
        <span className="col-span-2 font-semibold md:col-span-1 md:text-right">
          <span className="md:hidden">Per year: </span>
          {formatCadExact(line.annualCents)}
        </span>
      </div>
      {actions && (
        <div className="flex flex-wrap items-start gap-3">
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
