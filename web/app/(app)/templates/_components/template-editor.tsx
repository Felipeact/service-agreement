"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { agreementRichWarnings, previewBodyFromRichForm, type AgreementRichForm } from "@/domain/agreement/rich-form";
import { DetailsFields, PresetLines } from "./block-options";
import type { EditorPageEnv } from "./rich-editor/env";
import { SAVE_MESSAGES, type SaveTemplateState } from "./state";

/** The Word-style editor is large (ProseMirror and its extensions): it loads in the browser only, after the page. */
const RichDocumentEditor = dynamic(() => import("./rich-editor/rich-document-editor").then((module) => module.RichDocumentEditor), {
  ssr: false,
  loading: () => <div aria-busy="true" aria-label="Loading the editor" className="h-[70dvh] animate-pulse rounded-panel border border-hairline bg-surface shadow-card motion-reduce:animate-none" />,
}) as typeof import("./rich-editor/rich-document-editor").RichDocumentEditor;

export type TemplateTypeOption = { code: string; name: string };

type SaveAction = (templateId: string | null, input: AgreementRichForm) => Promise<SaveTemplateState>;

type EditorProps = {
  /** `null` for a new template. */
  templateId: string | null;
  initial: AgreementRichForm;
  types: TemplateTypeOption[];
  save: SaveAction;
  env: EditorPageEnv;
  /** Shown above the page: an older template opened in this editor is saved as a designed page. */
  converted?: boolean;
};

/**
 * The agreement template editor: the Word-style page with the template's name, description, term length and preset lines. It holds
 * what is typed, sends it to the save action, and keeps it on the page when the answer is a refusal.
 */
export function TemplateEditor({ templateId, initial, types, save, env, converted = false }: EditorProps) {
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<SaveTemplateState>({ status: "idle" });
  const [pending, start] = useTransition();

  const saveErrors = state.status === "invalid" ? state.errors : {};
  // What the page cannot be saved as shows while designing; the name is only required to save, so it waits for a save.
  const live = previewBodyFromRichForm(values);
  const errors = { ...(live.ok ? {} : live.errors), ...saveErrors };
  const message = state.status === "idle" || state.status === "invalid" ? null : SAVE_MESSAGES[state.status];

  return (
    <RichDocumentEditor
      document="agreement"
      env={env}
      values={values}
      onChange={(next) => {
        if (state.status === "invalid") setState({ status: "idle" });
        setValues(next);
      }}
      errors={errors}
      warnings={agreementRichWarnings(values)}
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
      partExtras={(key) => (key === "price" ? <PresetLines lines={values.lines} types={types} errors={errors} onChange={(lines) => setValues((was) => ({ ...was, lines }))} /> : null)}
      dirty={JSON.stringify(values) !== JSON.stringify(initial)}
      preview={{ endpoint: "/templates/preview", fileName: `${values.name.trim() || "template"} preview.pdf`, frameTitle: "Agreement PDF preview", note: "Marked TEMPLATE PREVIEW on every page. Nothing is saved or sent from here." }}
      saveLabel="Save template"
      pending={pending}
      notices={
        <>
          {converted && (
            <p role="status" className="rounded-control bg-ground px-3 py-2 text-[13px] font-medium text-ink">
              This template opens in the new page editor. Saving updates it; agreements already sent keep the version they used.
            </p>
          )}
          {Object.keys(saveErrors).length > 0 && (
            <p role="alert" className="rounded-control bg-attention-bg px-3 py-2 text-[13px] font-medium text-attention-fg">
              Fix what is listed under Before you save, then save again. Nothing you typed is lost.
            </p>
          )}
          {message && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {message}
            </p>
          )}
        </>
      }
      onSubmit={(latest) =>
        start(async () => {
          setValues(latest);
          setState(await save(templateId, latest));
        })
      }
      cancelHref="/templates"
    />
  );
}
