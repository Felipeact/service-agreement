import type { FormEvent, ReactNode } from "react";
import { Button } from "@/components/ui/button";

/** The Update card button: disabled and relabelled while the server prepares the card field (billing-page AC 17). */
export function CardUpdateButton({ pending, onClick }: { pending: boolean; onClick?: () => void }) {
  return (
    <Button variant="secondary" disabled={pending} onClick={onClick}>
      {pending ? "Opening…" : "Update card"}
    </Button>
  );
}

type CardFormShellProps = {
  pending: boolean;
  /** Stripe's own message, or ours, shown beside the field. */
  error: string | null;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  children?: ReactNode;
};

/** The frame around Stripe's card field: one submit control, disabled while the card is confirmed and saved (AC 17). */
export function CardFormShell({ pending, error, onCancel, onSubmit, children }: CardFormShellProps) {
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {children}
      {error && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save card"}
        </Button>
        <Button onClick={onCancel} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

type CancelPromptProps = {
  confirming: boolean;
  pending: boolean;
  /** The day service would end, as shown ("Dec 10, 2026"). */
  endDate: string;
  onStart?: () => void;
  onDismiss?: () => void;
  onConfirm?: (event: FormEvent<HTMLFormElement>) => void;
};

/** Two steps: the first button only asks, and nothing is cancelled until "Yes, cancel" is pressed (billing-page AC 19, 20). */
export function CancelPrompt({ confirming, pending, endDate, onStart, onDismiss, onConfirm }: CancelPromptProps) {
  if (!confirming) {
    return (
      <Button variant="secondary" onClick={onStart}>
        Cancel subscription
      </Button>
    );
  }
  return (
    <form onSubmit={onConfirm} className="flex flex-col gap-3">
      <p className="text-[13px] font-medium text-ink">{`Cancel your subscription? Service ends on ${endDate} and you keep access until then.`}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Cancelling…" : "Yes, cancel"}
        </Button>
        <Button onClick={onDismiss} disabled={pending}>
          Keep subscription
        </Button>
      </div>
    </form>
  );
}
