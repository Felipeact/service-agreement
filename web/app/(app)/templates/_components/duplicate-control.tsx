"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { TEMPLATE_MESSAGES, type DuplicateTemplateState } from "./state";

type DuplicateAction = (templateId: string) => Promise<DuplicateTemplateState>;

const ITEM = "flex min-h-11 w-full items-center px-3 text-left text-[13px] font-medium text-ink hover:bg-ground disabled:opacity-50 lg:min-h-9";

/** Saves a copy and opens its editor; a form, so it works by touch (agreement-templates AC 19). `item` is a row of the card menu. */
export function DuplicateControl({ templateId, action, look = "button" }: { templateId: string; action: DuplicateAction; look?: "item" | "button" }) {
  const [state, formAction, pending] = useActionState<DuplicateTemplateState, FormData>(() => action(templateId), { status: "idle" });
  const failed = state.status !== "idle";
  return (
    <form action={formAction} className="flex flex-col gap-2">
      {look === "item" ? (
        <button type="submit" disabled={pending} className={ITEM}>
          {pending ? "Duplicating…" : "Duplicate"}
        </button>
      ) : (
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Duplicating…" : "Duplicate"}
        </Button>
      )}
      {failed && (
        <p role="alert" className="px-1 text-[13px] font-medium text-danger">
          {TEMPLATE_MESSAGES[state.status as keyof typeof TEMPLATE_MESSAGES]}
        </p>
      )}
    </form>
  );
}
