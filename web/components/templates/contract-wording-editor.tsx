"use client";

import { useState, useTransition } from "react";
import { bodyFromContractForm, type ContractLayoutForm } from "@/domain/contract/layout-form";
import { ContractImportControl } from "./contract-import-control";
import { DocumentEditor } from "./document-editor";
import { firstErrorRow } from "./first-error-row";
import { WORDING_MESSAGES, type ImportContractWordingState, type SaveContractWordingState } from "./state";

type Props = {
  initial: ContractLayoutForm;
  save: (input: ContractLayoutForm) => Promise<SaveContractWordingState>;
  /** Reads an uploaded contract into rows; without it the editor shows no Import control. */
  importAction?: (formData: FormData) => Promise<ImportContractWordingState>;
  /** The company's name, for the page's letterhead. */
  orgName?: string;
};

const canDrawWording = (values: ContractLayoutForm) => bodyFromContractForm(values).ok;

/**
 * The contract wording in the shared document editor (template-editor-v2 S5): the same page, panel and rows as an agreement template, with
 * the signatures part among them. Saving writes the next version; what was typed stays on a refusal.
 */
export function ContractWordingEditor({ initial, save, importAction, orgName = "Your company" }: Props) {
  const [values, setValues] = useState(initial);
  // The rows as last saved (or as loaded), so an import knows whether it would overwrite edits (contract-import AC 15).
  const [baseline, setBaseline] = useState(initial);
  const [importedFrom, setImportedFrom] = useState<string | null>(null);
  const [state, setState] = useState<SaveContractWordingState>({ status: "idle" });
  const [jump, setJump] = useState<{ row: number; token: number } | null>(null);
  const [pending, start] = useTransition();

  const saveErrors = state.status === "invalid" ? state.errors : {};
  const live = bodyFromContractForm(values);
  const errors = { ...(live.ok ? {} : live.errors), ...saveErrors };
  const failed = state.status === "forbidden" || state.status === "not_found" || state.status === "unavailable";
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);

  return (
    <DocumentEditor
      document="contract"
      orgName={orgName}
      values={values}
      onChange={(next) => {
        // A row added or removed shifts the numbers a save's messages were written for.
        if (state.status === "invalid" && next.layout.length !== values.layout.length) setState({ status: "idle" });
        setValues(next);
      }}
      errors={errors}
      heading={<h2 className="font-display text-[18px] font-semibold tracking-tight">Contract wording</h2>}
      extra={
        importAction && (
          <ContractImportControl
            importAction={importAction}
            dirty={dirty}
            onImported={(form, fileName) => {
              setValues(form);
              setImportedFrom(fileName);
              setState({ status: "idle" });
            }}
          />
        )
      }
      dirty={dirty}
      preview={{ endpoint: "/templates/contract/preview", canDraw: canDrawWording, frameTitle: "Contract PDF preview" }}
      saveLabel="Save wording"
      pending={pending}
      jumpTo={jump}
      notices={
        <>
          {importedFrom && (
            <p role="status" className="rounded-control bg-ground px-3 py-2 text-[13px] font-medium text-ink">
              Imported from {importedFrom}. Nothing is saved until you save.
            </p>
          )}
          {Object.keys(saveErrors).length > 0 && (
            <p role="alert" className="rounded-control bg-attention-bg px-3 py-2 text-[13px] font-medium text-attention-fg">
              Fix the highlighted fields, then save again. Nothing you typed is lost.
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
      onSubmit={() =>
        start(async () => {
          const answer = await save(values);
          if (answer.status === "saved") {
            setBaseline(values);
            setImportedFrom(null);
          }
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
