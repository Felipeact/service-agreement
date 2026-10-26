"use client";

import { useActionState } from "react";
import type { ContactInput } from "@/domain/records";
import { TextInput } from "@/components/ui/text-input";
import { RecordForm } from "./record-form";
import { fieldErrors, shownValues, type RecordFormState } from "./state";

export type ContactFormState = RecordFormState<ContactInput>;

type FieldsProps = {
  values: ContactInput;
  state: ContactFormState;
  pending: boolean;
  submitLabel: string;
  cancelHref: string;
  action?: (formData: FormData) => void;
};

export function ContactFields({ values, state, ...form }: FieldsProps) {
  const errors = fieldErrors(state);
  return (
    <RecordForm status={state.status} {...form}>
      <TextInput id="name" name="name" label="Contact name" defaultValue={values.name} error={errors.name} autoComplete="name" />
      <TextInput id="email" name="email" type="email" label="Email" defaultValue={values.email} error={errors.email} autoComplete="email" />
      <TextInput id="phone" name="phone" type="tel" label="Phone" defaultValue={values.phone} error={errors.phone} autoComplete="tel" />
    </RecordForm>
  );
}

type FormProps = {
  initial: ContactInput;
  submitLabel: string;
  cancelHref: string;
  action: (state: ContactFormState, formData: FormData) => Promise<ContactFormState>;
};

export function ContactForm({ initial, action, ...props }: FormProps) {
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  return <ContactFields values={shownValues(state, initial)} state={state} pending={pending} action={formAction} {...props} />;
}
