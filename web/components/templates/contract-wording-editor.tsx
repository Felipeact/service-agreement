"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { bodyFromContractForm, type ContractLayoutForm } from "@/domain/contract/layout-form";
import { LayoutFields } from "./layout-fields";
import { WORDING_MESSAGES, type SaveContractWordingState } from "./state";
import { TemplatePreviewFrame } from "./template-preview-frame";

type Props = {
  initial: ContractLayoutForm;
  save: (input: ContractLayoutForm) => Promise<SaveContractWordingState>;
};

const canDrawWording = (values: ContractLayoutForm) => bodyFromContractForm(values).ok;

/** What a row is, in order: a message keyed to a row number stops being true when this changes. */
const shapeOf = (form: ContractLayoutForm) => form.layout.map((row) => (row.kind === "block" ? `block:${row.type}` : `section:${row.key}`)).join();

/**
 * The contract wording as a block editor with the contract PDF beside it (block-editor S5): the same document options and rows as
 * an agreement template, with the signatures section among them. Saving writes the next version; what was typed stays on a refusal.
 */
export function ContractWordingEditor({ initial, save }: Props) {
  const [values, setValues] = useState(initial);
  const [state, setState] = useState<SaveContractWordingState>({ status: "idle" });
  const [pending, start] = useTransition();

  const saveErrors = state.status === "invalid" ? state.errors : {};
  const live = bodyFromContractForm(values);
  const errors = { ...(live.ok ? {} : live.errors), ...saveErrors };
  const failed = state.status === "forbidden" || state.status === "not_found" || state.status === "unavailable";

  return (
    <div className="flex flex-col gap-6 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start xl:gap-8">
      <section aria-label="Contract wording form" className="min-w-0">
        <form
          noValidate
          className="flex max-w-3xl flex-col gap-5"
          onSubmit={(event) => {
            event.preventDefault();
            start(async () => {
              setState(await save(values));
            });
          }}
        >
          {Object.keys(saveErrors).length > 0 && (
            <p role="alert" className="rounded-control bg-attention-bg px-3 py-2 text-[13px] font-medium text-attention-fg">
              Fix the highlighted fields, then save again. Nothing you typed is lost.
            </p>
          )}
          <LayoutFields
            value={values}
            document="contract"
            errors={errors}
            onChange={(next) => {
              // A row added, removed or moved shifts the numbers the messages were written for.
              if (shapeOf(next) !== shapeOf(values)) setState({ status: "idle" });
              setValues(next);
            }}
          />
          {errors.body && (
            <p role="alert" className="text-[13px] font-medium text-danger">
              {errors.body}
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
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving…" : "Save wording"}
            </Button>
            <LinkButton href="/templates">Back to templates</LinkButton>
          </div>
        </form>
      </section>
      <TemplatePreviewFrame values={values} endpoint="/templates/contract/preview" canDraw={canDrawWording} frameTitle="Contract PDF preview" />
    </div>
  );
}
