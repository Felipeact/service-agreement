"use client";

import { useActionState, useState } from "react";
import {
  MONTH_PRESETS,
  MONTH_SHORT,
  PRESET_LABELS,
  prefillMonths,
  type EquipmentChoice,
  type MonthPreset,
  type ServiceLineInput,
} from "@/domain/agreement";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import { messageFor, type LineState } from "./state";

type LineFormProps = {
  /** Prefixes the field ids, so several forms can share a page. */
  idPrefix: string;
  initial: ServiceLineInput;
  state: LineState;
  pending: boolean;
  submitLabel: string;
  /** The equipment types the line can cover, in display order (cadence AC 8). */
  choices?: EquipmentChoice[];
  /** The checked visit months, 1 = January (lesson L-014: the control holds them). */
  checked?: number[];
  /** The checked equipment type ids. */
  types?: string[];
  onToggleMonth?: (month: number) => void;
  onToggleType?: (typeId: string) => void;
  onPreset?: (preset: MonthPreset) => void;
  /** The add or save action; absent in tests that only render markup. */
  action?: (formData: FormData) => void;
  onCancel?: () => void;
};

const legend = "text-[13px] font-medium text-ink";
const box = "size-4 shrink-0 accent-action";
/** A checkbox and its label as one 44px target (34px on desktop); a checked one wears the action tint. */
const choice =
  "flex min-h-11 cursor-pointer items-center gap-1.5 rounded-control border border-hairline bg-surface text-[13px] text-ink has-[:checked]:border-action has-[:checked]:bg-action-tint lg:min-h-[34px]";

const PRESETS = Object.keys(MONTH_PRESETS) as MonthPreset[];

/** Description, visit months, equipment covered and cost per visit; each field's message sits under it. */
export function LineForm({
  idPrefix,
  initial,
  state,
  pending,
  submitLabel,
  choices = [],
  checked = [],
  types = [],
  onToggleMonth,
  onToggleType,
  onPreset,
  action,
  onCancel,
}: LineFormProps) {
  const values = state.status === "invalid" ? state.values : initial;
  const errors = state.status === "invalid" ? state.errors : {};
  const message = messageFor(state.status);
  const monthsError = `${idPrefix}-visitMonths-error`;
  const typesError = `${idPrefix}-assetTypeIds-error`;
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)] md:items-start">
        <TextInput
          id={`${idPrefix}-description`}
          name="description"
          label="Description"
          defaultValue={values.description}
          error={errors.description}
          maxLength={200}
        />
        <TextInput
          id={`${idPrefix}-costPerVisit`}
          name="costPerVisit"
          label="Cost per visit"
          inputMode="decimal"
          placeholder="$0.00"
          defaultValue={values.costPerVisit}
          error={errors.costPerVisit}
        />
      </div>

      <fieldset className="flex flex-col gap-1.5" aria-describedby={errors.assetTypeIds ? typesError : undefined}>
        <legend className={`${legend} mb-1.5`}>Equipment covered</legend>
        <div className="flex flex-wrap gap-1.5">
          {choices.map((type) => (
            <label key={type.id} className={`${choice} px-3`}>
              <input
                type="checkbox"
                name="assetTypeIds"
                value={type.id}
                checked={types.includes(type.id)}
                onChange={() => onToggleType?.(type.id)}
                className={box}
              />
              {type.name}
            </label>
          ))}
        </div>
        {errors.assetTypeIds && (
          <p id={typesError} className="text-[12px] font-medium text-danger">
            {errors.assetTypeIds}
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-1.5" aria-describedby={errors.visitMonths ? monthsError : undefined}>
        <legend className={`${legend} mb-1.5`}>Visit months</legend>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((preset) => (
            <Button key={preset} onClick={() => onPreset?.(preset)}>
              {PRESET_LABELS[preset]}
            </Button>
          ))}
        </div>
        <div className="grid grid-cols-6 gap-1.5 md:grid-cols-12">
          {MONTH_SHORT.map((label, index) => {
            const month = index + 1;
            return (
              <label key={label} className={`${choice} justify-center`}>
                <input
                  type="checkbox"
                  name="visitMonths"
                  value={month}
                  checked={checked.includes(month)}
                  onChange={() => onToggleMonth?.(month)}
                  className={box}
                />
                {label}
              </label>
            );
          })}
        </div>
        {errors.visitMonths && (
          <p id={monthsError} className="text-[12px] font-medium text-danger">
            {errors.visitMonths}
          </p>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {submitLabel}
        </Button>
        {onCancel && <Button onClick={onCancel}>Cancel</Button>}
      </div>
      {message && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {message}
        </p>
      )}
    </form>
  );
}

type ControlProps = Omit<LineFormProps, "state" | "pending" | "action" | "checked" | "types" | "onToggleMonth" | "onToggleType" | "onPreset"> & {
  action: (formData: FormData) => Promise<LineState>;
  /** Called after a successful save, e.g. to close an inline editor. */
  onSaved?: () => void;
};

type Picked = { months: number[]; types: string[]; edited: boolean };

const toggled = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

/**
 * Holds the checked months and types. A new line's grid follows the checked types' default months until it is
 * changed by hand; a saved line's grid starts as edited, so its months never change by surprise (cadence AC 10).
 */
export function LineFormControl({ action, onSaved, initial, choices = [], ...props }: ControlProps) {
  const start = (): Picked => ({ months: initial.visitMonths.map(Number), types: initial.assetTypeIds, edited: initial.visitMonths.length > 0 });
  const [picked, setPicked] = useState<Picked>(start);
  const [state, formAction, pending] = useActionState<LineState, FormData>(
    async (_previous, formData) => {
      const next = await action(formData);
      if (next.status === "saved") {
        setPicked(start());
        onSaved?.();
      }
      return next;
    },
    { status: "idle" },
  );
  return (
    <LineForm
      {...props}
      initial={initial}
      choices={choices}
      state={state}
      pending={pending}
      action={formAction}
      checked={picked.months}
      types={picked.types}
      onToggleMonth={(month) => setPicked((p) => ({ ...p, months: toggled(p.months, month).sort((a, b) => a - b), edited: true }))}
      onPreset={(preset) => setPicked((p) => ({ ...p, months: [...MONTH_PRESETS[preset]], edited: true }))}
      onToggleType={(typeId) =>
        setPicked((p) => {
          const types = toggled(p.types, typeId);
          return { ...p, types, months: prefillMonths({ choices, checked: types, current: p.months, edited: p.edited }) };
        })
      }
    />
  );
}
