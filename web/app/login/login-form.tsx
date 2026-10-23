"use client";

import { useActionState } from "react";
import { requestSignInLinkAction } from "./actions";
import { LoginFields } from "./login-fields";
import { INITIAL_LOGIN_STATE } from "./state";

export function LoginForm({ linkInvalid }: { linkInvalid: boolean }) {
  const [state, action, pending] = useActionState(requestSignInLinkAction, INITIAL_LOGIN_STATE);
  return <LoginFields state={state} pending={pending} linkInvalid={linkInvalid} action={action} />;
}
