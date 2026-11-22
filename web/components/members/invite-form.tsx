"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, useEffect, useTransition } from "react";
import { useForm, type UseFormRegister } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { TextInput } from "@/components/ui/text-input";
import { DEFAULT_INVITE_ROLE, ROLES, ROLE_LABELS, validateInvitation } from "@/domain/members";
import { domainSchema, text } from "@/lib/forms/domain-schema";
import { INVITE_MESSAGES, type InviteFormState } from "./state";

type Props = { action: (state: InviteFormState, formData: FormData) => Promise<InviteFormState> };

type InviteValues = { email: string; role: string };

/** The invite form's presentational half: the fields, the button and the outcome of the last attempt (members-page S2). */
export function InviteFields({
  state,
  pending,
  formAction,
  onSubmit,
  register,
  errors,
}: {
  state: InviteFormState;
  pending?: boolean;
  formAction?: (formData: FormData) => void;
  /** The browser-side form (React Hook Form); without it the fields are plain and post through `formAction`. */
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  register?: UseFormRegister<InviteValues>;
  errors?: Partial<Record<string, string>>;
}) {
  const failed = state.status !== "idle" && state.status !== "sent";
  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="flex flex-col gap-4 rounded-panel border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-action-tint text-action">
          <Icon name="plus" />
        </span>
        <div className="flex flex-col">
          <h2 className="font-display text-[18px] leading-tight font-semibold tracking-tight">Invite someone</h2>
          <p className="text-[13px] text-ink-2">They get an email with a link to join. No password needed.</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextInput id="invite-email" type="email" label="Email" autoComplete="off" required className="sm:flex-1" error={errors?.email} {...(register ? register("email") : { name: "email" })} />
        <Select id="invite-role" label="Role" defaultValue={DEFAULT_INVITE_ROLE} className="sm:w-44" {...(register ? register("role") : { name: "role" })}>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Sending…" : "Send invitation"}
        </Button>
      </div>
      {state.status !== "idle" && (
        <p role={failed ? "alert" : "status"} className={`text-[13px] font-medium ${failed ? "text-danger" : "text-ink"}`}>
          {INVITE_MESSAGES[state.status](state.email)}
        </p>
      )}
    </form>
  );
}

const inviteSchema = domainSchema({ email: text(), role: text() }, (input) => (validateInvitation(input).ok ? { ok: true } : { ok: false, errors: { email: INVITE_MESSAGES.invalid("") } }));

/** The invite form: the address is checked in the browser first, then sent to the server action, which checks it again. */
export function InviteForm({ action }: Props) {
  const [state, formAction, actionPending] = useActionState<InviteFormState, FormData>(action, { status: "idle" });
  const [transitionPending, startTransition] = useTransition();
  const form = useForm<InviteValues>({ resolver: zodResolver(inviteSchema) as never, defaultValues: { email: "", role: DEFAULT_INVITE_ROLE }, mode: "onTouched" });
  const { reset } = form;
  // A sent invitation empties the address, ready for the next one; every other answer keeps what was typed.
  useEffect(() => {
    if (state.status === "sent") reset({ email: "", role: DEFAULT_INVITE_ROLE });
  }, [state, reset]);
  const onSubmit = form.handleSubmit((values) => {
    const data = new FormData();
    data.append("email", values.email);
    data.append("role", values.role);
    startTransition(() => formAction(data));
  });
  const errors = { email: typeof form.formState.errors.email?.message === "string" ? form.formState.errors.email.message : undefined };
  return <InviteFields state={state} pending={actionPending || transitionPending} onSubmit={onSubmit} register={form.register} errors={errors} />;
}
