"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, useEffect, useTransition } from "react";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";
import { shownValues, type RecordFormState } from "./state";

type Options<Input extends FieldValues> = {
  /** The form's Zod schema (see `domainSchema`). */
  schema: Parameters<typeof zodResolver>[0];
  initial: Input;
  action: (state: RecordFormState<Input>, formData: FormData) => Promise<RecordFormState<Input>>;
};

/**
 * A record form on React Hook Form and Zod: the browser checks the fields before anything is sent, and the server action
 * stays the authority and answers with its own messages, which land on the same fields. What was typed is kept after a
 * refusal. The fields are posted as `FormData`, so the server action reads them as it always did.
 */
export function useRecordForm<Input extends FieldValues>({ schema, initial, action }: Options<Input>) {
  const [state, formAction, actionPending] = useActionState(action, { status: "idle" } as RecordFormState<Input>);
  const [transitionPending, startTransition] = useTransition();
  const form = useForm<Input>({
    resolver: zodResolver(schema) as unknown as Resolver<Input>,
    defaultValues: shownValues(state, initial) as never,
    mode: "onTouched",
  });
  const { setError } = form;

  // The server's answer: its messages go on the fields, so a rule only the server can check shows in the same place.
  useEffect(() => {
    if (state.status !== "invalid") return;
    for (const [field, message] of Object.entries(state.errors)) {
      if (message) setError(field as never, { type: "server", message: String(message) });
    }
  }, [state, setError]);

  const onSubmit = form.handleSubmit((values) => {
    const data = new FormData();
    for (const [field, value] of Object.entries(values)) if (value !== undefined && value !== null) data.append(field, String(value));
    startTransition(() => formAction(data));
  });

  const errors: Partial<Record<string, string>> = {};
  for (const [field, error] of Object.entries(form.formState.errors)) {
    if (error && typeof error.message === "string") errors[field] = error.message;
  }
  return { state, pending: actionPending || transitionPending, register: form.register, onSubmit, errors };
}
