"use client";

import type { ContactView } from "@/application/ports";
import type { SiteInput } from "@/domain/records";
import { Select } from "@/components/ui/select";
import { TextInput } from "@/components/ui/text-input";
import { validateSite } from "@/domain/records";
import { domainSchema, text } from "@/lib/forms/domain-schema";
import type { UseFormRegister } from "react-hook-form";
import { RecordForm } from "./record-form";
import { fieldErrors, type RecordFormState } from "./state";
import { useRecordForm } from "./use-record-form";

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
  /** The browser-side form (React Hook Form); without it the fields are plain and post through `action`. */
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  register?: UseFormRegister<SiteInput>;
  /** Messages from the browser's check; they win over the server's. */
  errors?: Partial<Record<string, string>>;
};

export function SiteFields({ values, state, contacts, register, errors: live, ...form }: FieldsProps) {
  const errors = { ...fieldErrors(state), ...live };
  const byName = [...contacts].sort((a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }));
  const options = byName.map((contact) => (
    <option key={contact.id} value={contact.id}>
      {contact.name}
    </option>
  ));
  return (
    <RecordForm status={state.status} {...form}>
      <TextInput id="name" label="Site name" error={errors.name} defaultValue={values.name} {...(register ? register("name") : { name: "name" })} />
      <TextInput id="address" label="Address" error={errors.address} autoComplete="street-address" defaultValue={values.address} {...(register ? register("address") : { name: "address" })} />
      <Select id="siteContactId" label="Site contact" error={errors.siteContactId} defaultValue={values.siteContactId} {...(register ? register("siteContactId") : { name: "siteContactId" })}>
        <option value="">No site contact</option>
        {options}
      </Select>
      <Select
        id="approverContactId"
        label="Approver"
        error={errors.approverContactId}
        defaultValue={values.approverContactId ?? ""}
        {...(register ? register("approverContactId") : { name: "approverContactId" })}
      >
        <option value="">No approver</option>
        {options}
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

/** The site form: checked in the browser first, then sent to the server action, which checks it again. */
export function SiteForm({ initial, action, contacts, ...props }: FormProps) {
  const schema = domainSchema({ name: text(), address: text(), siteContactId: text(), approverContactId: text().optional() }, (input) =>
    validateSite(input, contacts.map((contact) => contact.id)),
  );
  const { state, pending, register, onSubmit, errors } = useRecordForm<SiteInput>({ schema, initial, action });
  return <SiteFields values={initial} state={state} contacts={contacts} pending={pending} onSubmit={onSubmit} register={register} errors={errors} {...props} />;
}
