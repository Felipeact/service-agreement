"use client";

import { useState, useTransition } from "react";
import { previewBodyFromLayoutForm, type AgreementLayoutForm } from "@/domain/agreement/template-form";
import { DetailsFields, PresetLines } from "./block-options";
import { DocumentEditor } from "./document-editor";
import { firstErrorRow } from "./first-error-row";
import { SAVE_MESSAGES, type SaveTemplateState } from "./state";

export type TemplateTypeOption = { code: string; name: string };

type SaveAction = (templateId: string | null, input: AgreementLayoutForm) => Promise<SaveTemplateState>;

type EditorProps = {
  /** `null` for a new template. */
  templateId: string | null;
  initial: AgreementLayoutForm;
  types: TemplateTypeOption[];
  save: SaveAction;
  /** The company's name, for the page's letterhead. */
  orgName?: string;
};

const canDrawLayout = (values: AgreementLayoutForm) => previewBodyFromLayoutForm(values).ok;

/**
 * The agreement template editor: the shared document editor with the template's name, description, term length and preset lines. It holds
 * what is typed, sends it to the save action, and keeps it on the page when the answer is a refusal.
 */
export function TemplateEditor({ templateId, initial, types, save, orgName = "Your company" }: EditorProps) {
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<SaveTemplateState>({ status: "idle" });
  const [jump, setJump] = useState<{ row: number; token: number } | null>(null);
  const [pending, start] = useTransition();

  const saveErrors = state.status === "invalid" ? state.errors : {};
  // The fields the preview cannot draw are highlighted as they are typed; the name is only required to save, so it waits for a save.
  const live = previewBodyFromLayoutForm(values);
  const errors = { ...(live.ok ? {} : live.errors), ...saveErrors };
  const message = state.status === "idle" || state.status === "invalid" ? null : SAVE_MESSAGES[state.status];

  return (
    <DocumentEditor
      document="agreement"
      orgName={orgName}
      values={values}
      onChange={(next) => {
        // A row added, removed or moved shifts the numbers a save's messages were written for.
        if (state.status === "invalid" && next.layout.length !== values.layout.length) setState({ status: "idle" });
        setValues(next as AgreementLayoutForm);
      }}
      errors={errors}
      heading={
        <div className="flex flex-col gap-0.5">
          <label htmlFor="template-name" className="sr-only">
            Name
          </label>
          <input
            id="template-name"
            name="name"
            value={values.name}
            placeholder="Name this template"
            onChange={(event) => setValues({ ...values, name: event.target.value })}
            aria-invalid={errors.name ? true : undefined}
            className={`min-h-11 w-full rounded-control border bg-transparent px-2 text-[15px] font-semibold tracking-tight text-ink placeholder:text-ink-2 hover:border-hairline focus:bg-surface lg:min-h-9 ${errors.name ? "border-danger" : "border-transparent"}`}
          />
          {errors.name && <p className="px-2 text-[12px] font-medium text-danger">{errors.name}</p>}
        </div>
      }
      details={<DetailsFields description={values.description} termMonths={values.termMonths} errors={errors} onChange={(change) => setValues({ ...values, ...change })} />}
      presetLines={values.lines}
      partExtras={(key) => (key === "price" ? <PresetLines lines={values.lines} types={types} errors={errors} onChange={(lines) => setValues({ ...values, lines })} /> : null)}
      dirty={JSON.stringify(values) !== JSON.stringify(initial)}
      preview={{ endpoint: "/templates/preview", canDraw: canDrawLayout, frameTitle: "Agreement PDF preview" }}
      saveLabel="Save template"
      pending={pending}
      jumpTo={jump}
      notices={
        <>
          {Object.keys(saveErrors).length > 0 && (
            <p role="alert" className="rounded-control bg-attention-bg px-3 py-2 text-[13px] font-medium text-attention-fg">
              Fix the highlighted fields, then save again. Nothing you typed is lost.
            </p>
          )}
          {message && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {message}
            </p>
          )}
        </>
      }
      onSubmit={() =>
        start(async () => {
          const answer = await save(templateId, values);
          setState(answer);
          if (answer.status === "invalid") {
            const row = firstErrorRow(answer.errors);
            if (row !== null) setJump((was) => ({ row, token: (was?.token ?? 0) + 1 }));
          }
        })
      }
      cancelHref="/templates"
    />
  );
}
