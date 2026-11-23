"use client";

import type { ContactView } from "@/application/ports";
import type { CustomerInput } from "@/domain/records";
import { Select } from "@/components/ui/select";
import { TextInput } from "@/components/ui/text-input";
import { domainSchema, text } from "@/lib/forms/domain-schema";
import { validateCustomer } from "@/domain/records";
import { RecordForm } from "./record-form";
import { fieldErrors, type RecordFormState } from "./state";
import { useRecordForm } from "./use-record-form";
import type { UseFormRegister } from "react-hook-form";

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
  /** The browser-side form (React Hook Form); without it the fields are plain and post through `action`. */
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  register?: UseFormRegister<CustomerInput>;
  /** Messages from the browser's check; they win over the server's. */
  errors?: Partial<Record<string, string>>;
};

export function CustomerFields({ values, state, contacts = [], register, errors: live, ...form }: FieldsProps) {
  const errors = { ...fieldErrors(state), ...live };
  const byName = [...contacts].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  return (
    <RecordForm status={state.status} {...form}>
      <TextInput id="name" label="Customer name" error={errors.name} autoComplete="organization" defaultValue={values.name} {...(register ? register("name") : { name: "name" })} />
      {byName.length > 0 && (
        <Select
          id="billingContactId"
          label="Billing contact"
          error={errors.billingContactId}
          defaultValue={values.billingContactId ?? ""} {...(register ? register("billingContactId") : { name: "billingContactId" })}
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

/** The customer form: checked in the browser first, then sent to the server action, which checks it again. */
export function CustomerForm({ initial, action, contacts = [], ...props }: FormProps) {
  const schema = domainSchema({ name: text(), billingContactId: text().optional() }, (input) => validateCustomer(input, contacts.map((contact) => contact.id)));
  const { state, pending, register, onSubmit, errors } = useRecordForm<CustomerInput, CustomerFormState>({ schema, initial, action });
  return <CustomerFields values={initial} state={state} contacts={contacts} pending={pending} onSubmit={onSubmit} register={register} errors={errors} {...props} />;
}
