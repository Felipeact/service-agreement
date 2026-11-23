"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { TEMPLATE_MESSAGES, type CustomizeTemplateState } from "./state";

type CustomizeAction = (templateId: string) => Promise<CustomizeTemplateState>;

/** Saves the system template as the org's own and opens its editor; a form, so it works by touch (template-flow AC 14). */
export function CustomizeControl({ templateId, action }: { templateId: string; action: CustomizeAction }) {
  const [state, formAction, pending] = useActionState<CustomizeTemplateState, FormData>(() => action(templateId), { status: "idle" });
  const failed = state.status !== "idle";
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Customizing…" : "Customize"}
      </Button>
      {failed && (
        <p role="alert" className="px-1 text-[13px] font-medium text-danger">
          {TEMPLATE_MESSAGES[state.status as keyof typeof TEMPLATE_MESSAGES]}
        </p>
      )}
    </form>
  );
}
