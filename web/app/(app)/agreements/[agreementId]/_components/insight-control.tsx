"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { SparklesIcon } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import type { InsightState } from "@/components/agreements/state";

const KIND_LABEL = { risk: "Risk", opportunity: "Opportunity", next_step: "Next step" } as const;

const FAILURE_MESSAGE: Record<Exclude<InsightState["status"], "ready" | "idle">, string> = {
  forbidden: "You cannot ask for an insight on this agreement.",
  not_found: "This agreement could not be found.",
  unavailable: "The AI Insight is not available right now. Try again in a moment.",
};

/**
 * The AI Insight button: asks the model what to look at on the agreement, then shows the answer in a modal. Nothing is saved, and
 * the answer never changes the agreement.
 */
export function InsightControl({ action }: { action: () => Promise<InsightState> }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<InsightState>({ status: "idle" });
  const [pending, startTransition] = useTransition();

  function handleAsk() {
    setOpen(true);
    setState({ status: "idle" });
    startTransition(async () => setState(await action().catch(() => ({ status: "unavailable" }) as const)));
  }

  return (
    <>
      <Button onClick={handleAsk} disabled={pending} className="border-transparent bg-violet-600 text-white shadow-card hover:bg-violet-700">
        <SparklesIcon className="size-4" aria-hidden="true" />
        AI Insight
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="AI Insight" sub="A read of this agreement. Check it before you rely on it.">
        {pending || state.status === "idle" ? (
          <p role="status" className="text-[13px] text-ink-2">
            Reading the agreement…
          </p>
        ) : state.status === "ready" ? (
          <div className="flex flex-col gap-3">
            <p className="text-[14px]">{state.summary}</p>
            {state.notes.length > 0 && (
              <ul className="flex flex-col gap-2">
                {state.notes.map((note) => (
                  <li key={`${note.kind}:${note.text}`} className="rounded-control border border-hairline px-3 py-2 text-[13px]">
                    <span className="font-semibold">{KIND_LABEL[note.kind]}: </span>
                    {note.text}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {FAILURE_MESSAGE[state.status]}
          </p>
        )}
      </Modal>
    </>
  );
}
