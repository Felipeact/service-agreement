"use client";

import { useActionState } from "react";
import type { ContactView } from "@/application/ports";
import type { SiteInput } from "@/domain/records";
import { Select } from "@/components/ui/select";
import { TextInput } from "@/components/ui/text-input";
import { RecordForm } from "./record-form";
import { fieldErrors, shownValues, type RecordFormState } from "./state";

export type SiteFormState = RecordFormState<SiteInput>;

type SiteContact = Pick<ContactView, "id" | "name">;

type FieldsProps = {
  values: SiteInput;
  state: SiteFormState;
  /** The contacts of the site's customer; the only ones a site may name. */
  contacts: SiteContact[];
  pending: boolean;
  submitLabel: string;
  cancelHref: string;
  action?: (formData: FormData) => void;
};

export function SiteFields({ values, state, contacts, ...form }: FieldsProps) {
  const errors = fieldErrors(state);
  const byName = [...contacts].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  return (
    <RecordForm status={state.status} {...form}>
      <TextInput id="name" name="name" label="Site name" defaultValue={values.name} error={errors.name} />
      <TextInput id="address" name="address" label="Address" defaultValue={values.address} error={errors.address} autoComplete="street-address" />
      <Select id="siteContactId" name="siteContactId" label="Site contact" defaultValue={values.siteContactId} error={errors.siteContactId}>
        <option value="">No site contact</option>
        {byName.map((contact) => (
          <option key={contact.id} value={contact.id}>
            {contact.name}
          </option>
        ))}
      </Select>
    </RecordForm>
  );
}

type FormProps = {
  initial: SiteInput;
  contacts: SiteContact[];
  submitLabel: string;
  cancelHref: string;
  action: (state: SiteFormState, formData: FormData) => Promise<SiteFormState>;
};

export function SiteForm({ initial, action, ...props }: FormProps) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  return <SiteFields values={shownValues(state, initial)} state={state} pending={pending} action={formAction} {...props} />;
}
