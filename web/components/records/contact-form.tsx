"use client";

import type { ContactInput } from "@/domain/records";
import { TextInput } from "@/components/ui/text-input";
import { validateContact } from "@/domain/records";
import { domainSchema, text } from "@/lib/forms/domain-schema";
import type { UseFormRegister } from "react-hook-form";
import { RecordForm } from "./record-form";
import { fieldErrors, type RecordFormState } from "./state";
import { useRecordForm } from "./use-record-form";

export type ContactFormState = RecordFormState<ContactInput>;

type FieldsProps = {
  values: ContactInput;
  state: ContactFormState;
  pending: boolean;
  submitLabel: string;
  cancelHref: string;
  action?: (formData: FormData) => void;
  /** The browser-side form (React Hook Form); without it the fields are plain and post through `action`. */
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  register?: UseFormRegister<ContactInput>;
  /** Messages from the browser's check; they win over the server's. */
  errors?: Partial<Record<string, string>>;
};

export function ContactFields({ values, state, register, errors: live, ...form }: FieldsProps) {
  const errors = { ...fieldErrors(state), ...live };
  return (
    <RecordForm status={state.status} {...form}>
      <TextInput id="name" label="Contact name" error={errors.name} autoComplete="name" defaultValue={values.name} {...(register ? register("name") : { name: "name" })} />
      <TextInput id="email" type="email" label="Email" error={errors.email} autoComplete="email" defaultValue={values.email} {...(register ? register("email") : { name: "email" })} />
      <TextInput id="phone" type="tel" label="Phone" error={errors.phone} autoComplete="tel" defaultValue={values.phone} {...(register ? register("phone") : { name: "phone" })} />
    </RecordForm>
  );
}

type FormProps = {
  initial: ContactInput;
  submitLabel: string;
  cancelHref: string;
  action: (state: ContactFormState, formData: FormData) => Promise<ContactFormState>;
};

const contactSchema = domainSchema({ name: text(), email: text(), phone: text() }, (input) => validateContact(input));

/** The contact form: checked in the browser first, then sent to the server action, which checks it again. */
export function ContactForm({ initial, action, ...props }: FormProps) {
  const { state, pending, register, onSubmit, errors } = useRecordForm<ContactInput>({ schema: contactSchema, initial, action });
  return <ContactFields values={initial} state={state} pending={pending} onSubmit={onSubmit} register={register} errors={errors} {...props} />;
}
