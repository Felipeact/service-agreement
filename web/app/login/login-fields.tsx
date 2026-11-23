"use client";

import * as motion from "motion/react-client";
import { useState, type FormEvent } from "react";
import type { UseFormRegister } from "react-hook-form";
import { TAP } from "@/components/motion/variants";
import type { LoginState } from "./state";

type Notice = { title: string; detail?: string };

const NOTICES: Partial<Record<LoginState["status"], Notice>> = {
  invalid_email: { title: "Enter a valid email address." },
  rate_limited: { title: "Too many sign-in emails.", detail: "Wait a minute and try again." },
  unavailable: { title: "We couldn't send the link.", detail: "Try again." },
};

/** What the mockup's alert says when a link has expired or was already used (the visitor arrived from `/login?error=link_invalid`). */
const LINK_EXPIRED: Notice = { title: "Sign-in link expired or consumed.", detail: "Please enter your email below to receive a new one." };

type LoginFieldsProps = {
  state: LoginState;
  pending: boolean;
  /** Set when the user arrived from a link that failed (`/login?error=link_invalid`). */
  linkInvalid: boolean;
  action?: (formData: FormData) => void;
  /** The browser-side form (React Hook Form); without it the field is plain and posts through `action`. */
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  register?: UseFormRegister<{ email: string }>;
};

/**
 * The sign-in card's content from the owner's mockup (docs/service_pacts_sign_in_animated_split_1): an alert when
 * something needs saying, the email form, and a confirmation once the link is sent. The mockup shows its expired-link
 * alert permanently as a demonstration; here it appears only when it is true.
 */
export function LoginFields({ state, pending, linkInvalid, action, onSubmit, register }: LoginFieldsProps) {
  const [dismissed, setDismissed] = useState(false);
  const notice = NOTICES[state.status] ?? (state.status === "idle" && linkInvalid ? LINK_EXPIRED : undefined);
  const email = state.status === "idle" ? "" : state.email;
  return (
    <>
      {notice && !dismissed && (
        <div className="bg-amber-50/90 border border-amber-200/90 text-amber-900 text-[13px] rounded-xl p-3.5 mb-5 leading-snug font-normal flex items-start gap-2.5 shadow-xs" data-purpose="alert-expired-token" role="alert"><span className="material-symbols-outlined text-amber-600 text-[18px] shrink-0 mt-0.5">info</span><div className="flex-1"><span className="font-medium text-amber-900">{notice.title}</span>{notice.detail && <span className="text-amber-800/90 block mt-0.5">{notice.detail}</span>}</div><button aria-label="Dismiss notice" className="text-amber-600/70 hover:text-amber-900 transition-colors" type="button" onClick={() => setDismissed(true)}><span className="material-symbols-outlined text-[16px]">close</span></button></div>
      )}
      <form action={action} onSubmit={onSubmit} noValidate className="space-y-4" data-purpose="sign-in-form" id="signin-form"><div><div className="flex items-center justify-between mb-1.5"><label className="block text-[13px] font-semibold text-slate-800" htmlFor="work-email">{" "}Work email address{" "}</label><span className="text-[11px] text-slate-600">Company domain</span></div><div className="relative group"><div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-600 group-focus-within:text-blue-600 transition-colors"><span className="material-symbols-outlined text-[19px]">mail</span></div><input autoComplete="email" className="w-full h-11 pl-10 pr-3.5 bg-white border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-600/25 focus:border-blue-600 transition shadow-xs font-normal max-lg:min-h-11" id="work-email" defaultValue={email} {...(register ? register("email") : { name: "email" })} aria-invalid={state.status === "invalid_email" ? true : undefined} placeholder="contractor@servicepacts.com" type="email" /></div></div><div className="pt-1.5"><motion.button disabled={pending} className="group relative w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-sm font-semibold shadow-md shadow-blue-600/20 hover:shadow-lg hover:shadow-blue-600/30 active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-all duration-150" id="submit-btn" type="submit" whileTap={TAP}><span id="btn-text">{pending ? "Sending secure link..." : state.status === "sent" ? "Resend link" : "Email me a sign-in link"}</span><span className="material-symbols-outlined text-[18px] group-hover:translate-x-0.5 transition-transform">arrow_forward</span></motion.button></div></form>
      <div className="relative my-5"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div></div>
      {state.status === "sent" && (
        <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2" role="status"><span className="material-symbols-outlined text-emerald-600 text-[18px]">mark_email_read</span><span>Sign-in link sent! Check your inbox to finish signing in.</span></div>
      )}
    </>
  );
}
