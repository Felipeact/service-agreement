"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { CancelPrompt } from "./billing-parts";
import { BILLING_MESSAGES, type BillingActions, type SubscriptionResult } from "./state";

type Props = {
  /** The subscription is set to end: Resume is offered instead of Cancel. */
  ending: boolean;
  /** The day service ends or would end, as shown. */
  endDate: string;
  actions?: Pick<BillingActions, "cancel" | "resume">;
};

/** Cancel (after a confirming step) or Resume, with the Settings notice pattern for a refusal (billing-page S3). */
export function SubscriptionControls({ ending, endDate, actions }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function run(action: (() => Promise<SubscriptionResult>) | undefined) {
    if (!action || pending) return;
    setPending(true);
    setNotice(null);
    let result: SubscriptionResult = { status: "unavailable" };
    try {
      result = await action();
    } catch {
      // the notice below is the answer
    }
    setPending(false);
    if (result.status === "done") {
      setConfirming(false);
      router.refresh();
    } else setNotice(result.status === "forbidden" ? BILLING_MESSAGES.forbidden : BILLING_MESSAGES.unavailable);
  }

  const confirm = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void run(actions?.cancel);
  };

  return (
    <div className="flex flex-col gap-2">
      {ending ? (
        <div>
          <Button variant="primary" disabled={pending} onClick={() => void run(actions?.resume)}>
            {pending ? "Resuming…" : "Resume"}
          </Button>
        </div>
      ) : (
        <CancelPrompt confirming={confirming} pending={pending} endDate={endDate} onStart={() => setConfirming(true)} onDismiss={() => setConfirming(false)} onConfirm={confirm} />
      )}
      {notice && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {notice}
        </p>
      )}
    </div>
  );
}
