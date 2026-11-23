"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { XIcon } from "lucide-react";
import { Btn, INPUT, Field, PANEL } from "./kit";

/** A native `<dialog>` that opens as a modal while `open`, closes on Escape or its X, and returns focus to what opened it. */
export function Modal({ open, onClose, title, sub, children, wide = false }: { open: boolean; onClose: () => void; title: string; sub?: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-3xl" : "max-w-lg"} rounded-panel border border-hairline bg-surface p-0 text-ink shadow-panel backdrop:bg-ink/40`}
    >
      <div className="flex items-start gap-3 border-b border-hairline px-5 py-4">
        <div className="mr-auto">
          <h2 id={titleId} className="text-[17px] font-bold tracking-tight">{title}</h2>
          {sub && <p className="text-[13px] text-ink-2">{sub}</p>}
        </div>
        <button type="button" aria-label="Close" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-control text-ink-2 hover:bg-board hover:text-ink lg:size-8">
          <XIcon aria-hidden="true" className="size-4" />
        </button>
      </div>
      <div className="max-h-[70dvh] overflow-y-auto px-5 py-4">{children}</div>
    </dialog>
  );
}

/** A tab strip. The parent owns the selected value; each tab is 44px tall on a phone. */
export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { key: T; label: string; count?: number }[]; value: T; onChange: (key: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="-mx-1 flex gap-1 relative overflow-x-auto px-1">
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-control px-3 text-[13px] font-semibold transition-colors lg:h-9 ${active ? "bg-action-tint text-action-press" : "text-ink-nav hover:bg-board hover:text-ink"}`}
          >
            {tab.label}
            {tab.count !== undefined && <span className={`rounded-full px-1.5 text-[11px] ${active ? "bg-blue-100 text-action-press" : "bg-board text-ink-2"}`}>{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** A toast that says what just happened, in the same words as the button that caused it. */
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3200);
    return () => clearTimeout(timer);
  }, [message]);
  const node = message ? (
    <div role="status" className="menu-pop fixed right-4 bottom-20 z-50 rounded-panel border border-pill-completed-border bg-pill-completed px-4 py-3 text-[13px] font-semibold text-pill-completed-ink shadow-lift lg:bottom-6">
      {message}
    </div>
  ) : null;
  return { show: setMessage, node };
}

type Rule = (value: string) => string | undefined;
export const required = (what: string): Rule => (value) => (value.trim() ? undefined : `Enter ${what}.`);
export const email: Rule = (value) => (/^\S+@\S+\.\S+$/.test(value.trim()) ? undefined : "Enter an email like name@company.com.");
export const phone: Rule = (value) => (!value.trim() || value.replace(/\D/g, "").length === 10 ? undefined : "Enter a 10-digit phone number.");

/**
 * A form that checks its fields on submit (a stand-in for React Hook Form and Zod in the real screens), shows each message
 * under its field, and calls `onValid` with the values when everything passes.
 */
export function useFormCheck(rules: Record<string, Rule[]>, onValid: (values: Record<string, string>) => void) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    const next: Record<string, string> = {};
    for (const [name, list] of Object.entries(rules)) {
      for (const rule of list) {
        const message = rule(String(data[name] ?? ""));
        if (message) { next[name] = message; break; }
      }
    }
    setErrors(next);
    if (Object.keys(next).length === 0) onValid(data);
  }
  return { errors, handleSubmit, clear: () => setErrors({}) };
}

/** A text field wired to `useFormCheck`'s errors. */
export function TextField({ name, label, errors, hint, type = "text", defaultValue, placeholder, className }: { name: string; label: string; errors: Record<string, string>; hint?: string; type?: string; defaultValue?: string; placeholder?: string; className?: string }) {
  return (
    <Field label={label} hint={hint} error={errors[name]} className={className}>
      <input name={name} type={type} defaultValue={defaultValue} placeholder={placeholder} aria-invalid={errors[name] ? true : undefined} className={INPUT} />
    </Field>
  );
}

/** A form card with a footer of Cancel and a primary action, used by every create and edit screen. */
export function FormCard({ children, onSubmit, submit, cancelHref, busy }: { children: ReactNode; onSubmit: (event: FormEvent<HTMLFormElement>) => void; submit: string; cancelHref?: string; busy?: boolean }) {
  return (
    <form noValidate onSubmit={onSubmit} className={`${PANEL} flex flex-col`}>
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6">{children}</div>
      <div className="flex flex-col-reverse gap-2 rounded-b-panel border-t border-hairline bg-ground/60 p-4 sm:flex-row sm:justify-end sm:px-6">
        {cancelHref && <a href={cancelHref} className="inline-flex h-11 items-center justify-center rounded-control border border-hairline bg-surface px-4 text-[13px] font-semibold hover:border-line-strong lg:h-[38px]">Cancel</a>}
        <Btn type="submit" variant="primary" disabled={busy}>{submit}</Btn>
      </div>
    </form>
  );
}
