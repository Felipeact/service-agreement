"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, useEffect, useTransition } from "react";
import { useForm, type FieldValues, type Resolver } from "react-hook-form";

/** What a form's server action answers: a status, and for a refusal the messages per field with what was typed. */
type FormState<Input> = { status: string; errors?: Partial<Record<string, string>>; values?: Input };

type Options<Input extends FieldValues, State extends FormState<Input>> = {
  /** The form's Zod schema (see `domainSchema`). */
  schema: Parameters<typeof zodResolver>[0];
  initial: Input;
  action: (state: State, formData: FormData) => Promise<State>;
};

/**
 * A form on React Hook Form and Zod: the browser checks the fields before anything is sent, and the server action stays
 * the authority and answers with its own messages, which land on the same fields. What was typed is kept after a refusal.
 * What is posted is the form itself (`FormData` of the element), so hidden fields and a disabled field behave exactly as
 * in a plain form and the server action reads it as it always did.
 */
export function useRecordForm<Input extends FieldValues, State extends FormState<Input> = FormState<Input>>({ schema, initial, action }: Options<Input, State>) {
  const [state, formAction, actionPending] = useActionState<State, FormData>(action, { status: "idle" } as Awaited<State>);
  const [transitionPending, startTransition] = useTransition();
  const form = useForm<Input>({
    resolver: zodResolver(schema) as unknown as Resolver<Input>,
    defaultValues: (state.values ?? initial) as never,
    mode: "onTouched",
  });
  const { setError } = form;

  // The server's answer: its messages go on the fields, so a rule only the server can check shows in the same place.
  useEffect(() => {
    if (state.status !== "invalid" || !state.errors) return;
    for (const [field, message] of Object.entries(state.errors)) {
      if (message) setError(field as never, { type: "server", message: String(message) });
    }
  }, [state, setError]);

  const onSubmit = form.handleSubmit((_values, event) => {
    const element = event?.target as HTMLFormElement | undefined;
    if (!element) return;
    const data = new FormData(element);
    startTransition(() => (formAction as (payload: FormData) => void)(data));
  });

  const errors: Partial<Record<string, string>> = {};
  for (const [field, error] of Object.entries(form.formState.errors)) {
    if (error && typeof error.message === "string") errors[field] = error.message;
  }
  return { state, pending: actionPending || transitionPending, register: form.register, onSubmit, errors };
}
