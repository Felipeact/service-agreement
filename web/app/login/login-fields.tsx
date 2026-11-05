import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import type { LoginState } from "./state";

const NOTICES: Partial<Record<LoginState["status"], string>> = {
  rate_limited: "Too many sign-in emails. Wait a minute and try again.",
  unavailable: "We couldn't send the link. Try again.",
};

export const LINK_INVALID_NOTICE = "That sign-in link has expired or was already used. Request a new one.";

function Notice({ children }: { children: string }) {
  return (
    <p role="alert" className="rounded-control bg-attention-bg px-3 py-2.5 text-[13px] text-attention-fg">
      {children}
    </p>
  );
}

type LoginFieldsProps = {
  state: LoginState;
  pending: boolean;
  /** Set when the user arrived from a link that failed (`/login?error=link_invalid`). */
  linkInvalid: boolean;
  action?: (formData: FormData) => void;
};

/** The sign-in panel's content for one state; `LoginForm` supplies the state. */
export function LoginFields({ state, pending, linkInvalid, action }: LoginFieldsProps) {
  if (state.status === "sent") {
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-[22px] leading-tight font-bold">Check your email</h1>
        <p className="text-ink-2">
          We sent a sign-in link to <span className="font-semibold text-ink">{state.email}</span>.
        </p>
        <p className="text-ink-2">Open it on this device or any other to sign in.</p>
        <Link
          href="/login"
          className="mt-2 inline-flex h-11 items-center self-start rounded-control text-[13px] font-semibold text-action lg:h-[34px]"
        >
          Use a different email
        </Link>
      </div>
    );
  }

  const notice = NOTICES[state.status] ?? (state.status === "idle" && linkInvalid ? LINK_INVALID_NOTICE : undefined);
  const email = state.status === "idle" ? "" : state.email;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-[22px] leading-tight font-bold">Sign in</h1>
        <p className="text-ink-2">We&apos;ll email you a link to sign in. No password needed.</p>
      </div>
      {notice && <Notice>{notice}</Notice>}
      <form action={action} noValidate className="flex flex-col gap-4">
        <TextInput
          id="email"
          name="email"
          type="email"
          label="Work email"
          autoComplete="email"
          inputMode="email"
          defaultValue={email}
          error={state.status === "invalid_email" ? "Enter a valid email address" : undefined}
        />
        <Button type="submit" variant="primary" disabled={pending} className="w-full">
          {pending ? "Sending…" : "Email me a sign-in link"}
        </Button>
      </form>
    </div>
  );
}
