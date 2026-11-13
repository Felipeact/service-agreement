"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { TEMPLATE_MESSAGES, type ArchiveTemplateState } from "./state";

type ArchiveAction = (templateId: string) => Promise<ArchiveTemplateState>;

type PromptProps = {
  templateId: string;
  name: string;
  confirming: boolean;
  pending: boolean;
  state: ArchiveTemplateState;
  onStart?: () => void;
  onCancel?: () => void;
  /** The confirm form's action; absent in tests that only render markup. */
  action?: (formData: FormData) => void;
  /** `item` is a row of the card menu; `button` stands alone. */
  look?: "item" | "button";
};

const ITEM = "flex min-h-11 w-full items-center px-3 text-left text-[13px] font-medium text-danger hover:bg-ground lg:min-h-9";

/** Two steps, as `RemovePrompt`: Archive only asks, naming the template, and nothing changes until Confirm (agreement-templates AC 20). */
export function ArchivePrompt({ templateId, name, confirming, pending, state, onStart, onCancel, action, look = "item" }: PromptProps) {
  const failed = state.status !== "idle" && state.status !== "archived";
  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <form action={action} className="flex flex-col gap-2 px-3 py-2">
          <input type="hidden" name="templateId" value={templateId} />
          <p className="text-[13px] font-medium text-ink">{`Archive ${name}?`}</p>
          <p className="text-[13px] text-ink-2">It leaves the list. Agreements already using it keep their wording.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Archiving…" : "Confirm archive"}
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      ) : look === "item" ? (
        <button type="button" onClick={onStart} className={ITEM}>
          Archive
        </button>
      ) : (
        <div>
          <Button onClick={onStart}>Archive</Button>
        </div>
      )}
      {failed && (
        <p role="alert" className="px-3 pb-2 text-[13px] font-medium text-danger">
          {TEMPLATE_MESSAGES[state.status as keyof typeof TEMPLATE_MESSAGES]}
        </p>
      )}
    </div>
  );
}

export function ArchiveControl({ templateId, name, action, look }: { templateId: string; name: string; action: ArchiveAction; look?: "item" | "button" }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<ArchiveTemplateState, FormData>(() => action(templateId), { status: "idle" });
  return (
    <ArchivePrompt
      templateId={templateId}
      name={name}
      confirming={confirming}
      pending={pending}
      state={state}
      onStart={() => setConfirming(true)}
      onCancel={() => setConfirming(false)}
      action={formAction}
      look={look}
    />
  );
}
