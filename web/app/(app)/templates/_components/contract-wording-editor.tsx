"use client";

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { layoutFromRows } from "@/domain/agreement/layout-form";
import { bodyFromContractRichForm, contractRichWarnings, type ContractRichForm } from "@/domain/contract/rich-form";
import { richFromLayout, type RichDoc } from "@/domain/rich-document";
import { ContractImportControl } from "./contract-import-control";
import { HeaderPopover } from "./block-options";
import type { EditorPageEnv } from "./rich-editor/env";
import { WORDING_MESSAGES, type ImportContractWordingState, type SaveContractWordingState } from "./state";

/** The Word-style editor is large (ProseMirror and its extensions): it loads in the browser only, after the page. */
const RichDocumentEditor = dynamic(() => import("./rich-editor/rich-document-editor").then((module) => module.RichDocumentEditor), {
  ssr: false,
  loading: () => <div aria-busy="true" aria-label="Loading the editor" className="h-[70dvh] animate-pulse rounded-panel border border-hairline bg-surface shadow-card motion-reduce:animate-none" />,
}) as typeof import("./rich-editor/rich-document-editor").RichDocumentEditor;

type Props = {
  initial: ContractRichForm;
  save: (input: ContractRichForm) => Promise<SaveContractWordingState>;
  /** Reads an uploaded contract into the page; without it the editor shows no Import control. */
  importAction?: (formData: FormData) => Promise<ImportContractWordingState>;
  env: EditorPageEnv;
};

/**
 * The contract wording on the Word-style page, with the signatures section the signing service needs (it cannot be removed). Saving
 * writes the next version; what was typed stays on a refusal. An imported contract replaces the page in one step that Undo reverses.
 */
export function ContractWordingEditor({ initial, save, importAction, env }: Props) {
  const [values, setValues] = useState(initial);
  // The page as last saved (or as loaded), so an import knows whether it would overwrite edits (contract-import AC 15).
  const [baseline, setBaseline] = useState(initial);
  const [importedFrom, setImportedFrom] = useState<string | null>(null);
  const [replace, setReplace] = useState<{ content: RichDoc; token: number } | null>(null);
  const [state, setState] = useState<SaveContractWordingState>({ status: "idle" });
  const [pending, start] = useTransition();

  const saveErrors = state.status === "invalid" ? state.errors : {};
  const live = bodyFromContractRichForm(values);
  const errors = { ...(live.ok ? {} : live.errors), ...saveErrors };
  const failed = state.status === "forbidden" || state.status === "not_found" || state.status === "unavailable";
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);

  return (
    <RichDocumentEditor
      document="contract"
      env={env}
      values={values}
      onChange={(next) => {
        if (state.status === "invalid" || state.status === "saved") setState({ status: "idle" });
        setValues(next);
      }}
      errors={errors}
      warnings={contractRichWarnings(values)}
      heading={<h2 className="px-2 text-[15px] font-semibold tracking-tight">Contract wording</h2>}
      extra={
        importAction && (
          <HeaderPopover label="Import contract">
            <ContractImportControl
              importAction={importAction}
              dirty={dirty}
              onImported={(form, fileName) => {
                const content = richFromLayout(layoutFromRows(form.layout));
                setValues((was) => ({ doc: form.doc, content, header: was.header }));
                setReplace((was) => ({ content, token: (was?.token ?? 0) + 1 }));
                setImportedFrom(fileName);
                setState({ status: "idle" });
              }}
            />
          </HeaderPopover>
        )
      }
      dirty={dirty}
      preview={{ endpoint: "/templates/contract/render", fileName: "contract preview.pdf", frameTitle: "Contract PDF preview", note: "Drawn on sample data or the agreement you choose. Nothing is saved or sent from here." }}
      saveLabel="Save wording"
      pending={pending}
      replaceContent={replace}
      notices={
        <>
          {importedFrom && (
            <p role="status" className="rounded-control bg-ground px-3 py-2 text-[13px] font-medium text-ink">
              Imported from {importedFrom}. Nothing is saved until you save.
            </p>
          )}
          {Object.keys(saveErrors).length > 0 && (
            <p role="alert" className="rounded-control bg-attention-bg px-3 py-2 text-[13px] font-medium text-attention-fg">
              Fix what is listed under Before you save, then save again. Nothing you typed is lost.
            </p>
          )}
          {failed && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {WORDING_MESSAGES[state.status as "forbidden" | "not_found" | "unavailable"]}
            </p>
          )}
          {state.status === "saved" && (
            <p role="status" className="text-[13px] font-medium text-ink">
              {WORDING_MESSAGES.saved}
            </p>
          )}
        </>
      }
      onSubmit={(latest) =>
        start(async () => {
          setValues(latest);
          const answer = await save(latest);
          if (answer.status === "saved") {
            setBaseline(latest);
            setImportedFrom(null);
          }
          setState(answer);
        })
      }
      cancelHref="/templates"
    />
  );
}
