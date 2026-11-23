"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useActionState, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { isEmailAddress } from "@/domain/email";
import { domainSchema, text } from "@/lib/forms/domain-schema";
import { requestSignInLinkAction } from "./actions";
import { LoginFields } from "./login-fields";
import { INITIAL_LOGIN_STATE, type LoginState } from "./state";

const loginSchema = domainSchema({ email: text() }, (input) => (isEmailAddress(input.email) ? { ok: true } : { ok: false, errors: { email: "Enter a valid email address." } }));

/** The sign-in form: an address that cannot be one is refused in the browser, with the same alert the server uses; any other is sent for a link. */
export function LoginForm({ linkInvalid }: { linkInvalid: boolean }) {
  const [state, action, actionPending] = useActionState(requestSignInLinkAction, INITIAL_LOGIN_STATE);
  const [transitionPending, startTransition] = useTransition();
  const [refused, setRefused] = useState<string | null>(null);
  const form = useForm<{ email: string }>({ resolver: zodResolver(loginSchema) as never, defaultValues: { email: "" }, mode: "onSubmit" });
  const onSubmit = form.handleSubmit(
    (_values, event) => {
      const element = event?.target as HTMLFormElement | undefined;
      if (!element) return;
      setRefused(null);
      const data = new FormData(element);
      startTransition(() => action(data));
    },
    (_errors) => setRefused(form.getValues("email")),
  );
  const shown: LoginState = refused !== null ? { status: "invalid_email", email: refused } : state;
  return <LoginFields state={shown} pending={actionPending || transitionPending} linkInvalid={linkInvalid} onSubmit={onSubmit} register={form.register} />;
}
