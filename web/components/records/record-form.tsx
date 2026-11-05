import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { EmptyPanel } from "@/components/ui/empty-panel";
import { LinkButton } from "@/components/ui/link-button";
import { RECORD_MESSAGES } from "./state";

/** The page around a record form; a member who may not write gets the reason instead of the form. */
export function RecordPage({ title, canWrite, children }: { title: string; canWrite: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
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
  status: string;
  pending: boolean;
  submitLabel: string;
  cancelHref: string;
  children: ReactNode;
};

/** Fields, the failure alert, then Save and Cancel. Presentational: the caller owns the state. */
export function RecordForm({ action, status, pending, submitLabel, cancelHref, children }: RecordFormProps) {
  return (
    <form action={action} noValidate className="flex max-w-xl flex-col gap-5">
      <div className="flex flex-col gap-3">{children}</div>
      <FormAlert status={status} />
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        <LinkButton href={cancelHref}>Cancel</LinkButton>
      </div>
    </form>
  );
}
