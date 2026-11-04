"use client";

import { useActionState } from "react";
import type { ContactView } from "@/application/ports";
import type { CustomerInput } from "@/domain/records";
import { Select } from "@/components/ui/select";
import { TextInput } from "@/components/ui/text-input";
import { RecordForm } from "./record-form";
import { fieldErrors, shownValues, type RecordFormState } from "./state";

export type CustomerFormState = RecordFormState<CustomerInput>;

type FieldsProps = {
  values: CustomerInput;
  /** The customer's contacts, for the billing contact; none (a new customer) shows no such field. */
  contacts?: Pick<ContactView, "id" | "name">[];
  state: CustomerFormState;
  pending: boolean;
  submitLabel: string;
  cancelHref: string;
  action?: (formData: FormData) => void;
};

export function CustomerFields({ values, state, contacts = [], ...form }: FieldsProps) {
  const errors = fieldErrors(state);
  const byName = [...contacts].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  return (
    <RecordForm status={state.status} {...form}>
      <TextInput id="name" name="name" label="Customer name" defaultValue={values.name} error={errors.name} autoComplete="organization" />
      {byName.length > 0 && (
        <Select
          id="billingContactId"
          name="billingContactId"
          label="Billing contact"
          defaultValue={values.billingContactId ?? ""}
          error={errors.billingContactId}
        >
          <option value="">No billing contact</option>
          {byName.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.name}
            </option>
          ))}
        </Select>
      )}
    </RecordForm>
  );
}

type FormProps = {
  initial: CustomerInput;
  contacts?: Pick<ContactView, "id" | "name">[];
  submitLabel: string;
  cancelHref: string;
  action: (state: CustomerFormState, formData: FormData) => Promise<CustomerFormState>;
};

export function CustomerForm({ initial, action, ...props }: FormProps) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  return <CustomerFields values={shownValues(state, initial)} state={state} pending={pending} action={formAction} {...props} />;
}
