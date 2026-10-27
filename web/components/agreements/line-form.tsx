"use client";

import { useActionState } from "react";
import type { ServiceLineInput } from "@/domain/agreement";
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
  /** The add or save action; absent in tests that only render markup. */
  action?: (formData: FormData) => void;
  onCancel?: () => void;
};

/** Description, visits per year and cost per visit; each field's message sits under it. */
export function LineForm({ idPrefix, initial, state, pending, submitLabel, action, onCancel }: LineFormProps) {
  const values = state.status === "invalid" ? state.values : initial;
  const errors = state.status === "invalid" ? state.errors : {};
  const message = messageFor(state.status);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,3fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-start">
        <TextInput
          id={`${idPrefix}-description`}
          name="description"
          label="Description"
          defaultValue={values.description}
          error={errors.description}
          maxLength={200}
        />
        <TextInput
          id={`${idPrefix}-visitsPerYear`}
          name="visitsPerYear"
          label="Visits per year"
          inputMode="numeric"
          defaultValue={values.visitsPerYear}
          error={errors.visitsPerYear}
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

type ControlProps = Omit<LineFormProps, "state" | "pending" | "action"> & {
  action: (formData: FormData) => Promise<LineState>;
  /** Called after a successful save, e.g. to close an inline editor. */
  onSaved?: () => void;
};

export function LineFormControl({ action, onSaved, ...props }: ControlProps) {
  const [state, formAction, pending] = useActionState<LineState, FormData>(
    async (_previous, formData) => {
      const next = await action(formData);
      if (next.status === "saved") onSaved?.();
      return next;
    },
    { status: "idle" },
  );
  return <LineForm {...props} state={state} pending={pending} action={formAction} />;
}
