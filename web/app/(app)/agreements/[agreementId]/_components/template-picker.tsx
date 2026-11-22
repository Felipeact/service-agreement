"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { TEMPLATE_MESSAGES, type TemplateState } from "@/components/agreements/state";

export type TemplateChoice = { versionId: string; name: string };

type TemplatePickerProps = {
  /** The name of the template the shown version uses. */
  name: string;
  /** What a writer on an editable version can switch to; absent or empty means the name only. */
  choices?: readonly TemplateChoice[];
  /** The template version the version is pinned to now. */
  selectedVersionId?: string;
  change?: (templateVersionId: string) => Promise<TemplateState>;
};

/**
 * "Template: <name>", with a choice and a Change template button for a writer on a draft. Only the template changes: the lines, term
 * and scope stay as they are, and the PDF preview redraws (agreement-template-switch AC 2 to 4).
 */
export function TemplatePicker({ name, choices = [], selectedVersionId, change }: TemplatePickerProps) {
  const [chosen, setChosen] = useState(selectedVersionId ?? choices[0]?.versionId ?? "");
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const editable = change !== undefined && choices.length > 0;

  const apply = () => {
    if (!change || chosen === "" || chosen === selectedVersionId) return;
    startTransition(async () => {
      const result = await change(chosen);
      setMessage(result.status === "saved" ? null : result.status in TEMPLATE_MESSAGES ? TEMPLATE_MESSAGES[result.status as keyof typeof TEMPLATE_MESSAGES] : null);
    });
  };

  return (
    <section aria-label="Template" className="flex flex-col gap-2 rounded-panel border border-hairline bg-surface px-4 py-3">
      <p className="text-[13px] text-ink-2">
        {"Template: "}
        <span className="font-medium text-ink">{name}</span>
      </p>
      {editable && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-[13px] font-medium">
            Use another template
            <select
              value={chosen}
              onChange={(event) => setChosen(event.target.value)}
              disabled={pending}
              className="min-h-11 rounded-control border border-field bg-ground px-3 text-[13px] lg:min-h-[34px]"
            >
              {choices.map((choice) => (
                <option key={choice.versionId} value={choice.versionId}>
                  {choice.name}
                </option>
              ))}
            </select>
          </label>
          <Button onClick={apply} disabled={pending || chosen === selectedVersionId}>
            Change template
          </Button>
        </div>
      )}
      {editable && <p className="text-[12px] text-ink-2">Only the layout and wording change. Your service lines, term and scope stay as they are.</p>}
      {message && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {message}
        </p>
      )}
    </section>
  );
}
