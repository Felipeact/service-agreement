import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { LinkButton } from "@/components/ui/link-button";
import { RECORD_MESSAGES } from "./state";

/** The page around a record form; a member who may not write gets the reason instead of the form. */
export function RecordPage({ title, canWrite, children, back }: { title: string; canWrite: boolean; children: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      {back && (
        <Link href={back.href} className="inline-flex min-h-11 w-fit items-center gap-1 text-[13px] font-semibold text-action hover:underline lg:min-h-8">
          <span aria-hidden="true">←</span> {back.label}
        </Link>
      )}
      <PageHeader title={title} />
      {canWrite ? children : <EmptyPanel title={RECORD_MESSAGES.noAccess} />}
    </div>
  );
}

/** The alert for a failed submit or delete; nothing for the other states. */
export function FormAlert({ status }: { status: string }) {
  if (status === "not_found") {
    return (
      <p role="alert" className="text-[13px] font-medium text-danger">
        {RECORD_MESSAGES.not_found}{" "}
        <Link href="/customers" className="inline-flex min-h-11 items-center text-action lg:min-h-0">
          Back to customers
        </Link>
      </p>
    );
  }
  if (status === "forbidden" || status === "unavailable" || status === "in_use") {
    return (
      <p role="alert" className="text-[13px] font-medium text-danger">
        {RECORD_MESSAGES[status]}
      </p>
    );
  }
  return null;
}

type RecordFormProps = {
  /** The form action; absent in tests that only render markup. */
  action?: (formData: FormData) => void;
  /** Instead of `action`: a submit handler, for a form that validates in the browser first (React Hook Form). */
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  status: string;
  pending: boolean;
  submitLabel: string;
  cancelHref: string;
  children: ReactNode;
};

/** The fields in a framed card, the failure alert under them, then a footer bar with Cancel and Save. Presentational: the caller owns the state. */
export function RecordForm({ action, onSubmit, status, pending, submitLabel, cancelHref, children }: RecordFormProps) {
  return (
    <form action={action} onSubmit={onSubmit} noValidate className="flex flex-col rounded-panel border border-hairline bg-surface shadow-card">
      <div className="flex flex-col gap-4 p-4 sm:p-6">
        {children}
        <FormAlert status={status} />
      </div>
      <div className="flex flex-col-reverse gap-2 rounded-b-panel border-t border-hairline bg-ground/60 p-4 sm:flex-row sm:justify-end sm:px-6">
        <LinkButton href={cancelHref}>Cancel</LinkButton>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
