"use client";

import { useActionState } from "react";
import type { CustomerInput } from "@/domain/records";
import { TextInput } from "@/components/ui/text-input";
import { RecordForm } from "./record-form";
import { fieldErrors, shownValues, type RecordFormState } from "./state";

export type CustomerFormState = RecordFormState<CustomerInput>;

type FieldsProps = {
  values: CustomerInput;
  state: CustomerFormState;
  pending: boolean;
  submitLabel: string;
  cancelHref: string;
  action?: (formData: FormData) => void;
};

export function CustomerFields({ values, state, ...form }: FieldsProps) {
  const errors = fieldErrors(state);
  return (
    <RecordForm status={state.status} {...form}>
      <TextInput id="name" name="name" label="Customer name" defaultValue={values.name} error={errors.name} autoComplete="organization" />
    </RecordForm>
  );
}

type FormProps = {
  initial: CustomerInput;
  submitLabel: string;
  cancelHref: string;
  action: (state: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
};

export function CustomerForm({ initial, action, ...props }: FormProps) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  return <CustomerFields values={shownValues(state, initial)} state={state} pending={pending} action={formAction} {...props} />;
}
