"use client";

import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ContractLayoutForm } from "@/domain/contract/layout-form";
import { IMPORT_MESSAGES, IMPORT_NOTICE, type ImportContractWordingState } from "./state";

export const CONTRACT_IMPORT_ACCEPT = ".docx,.pdf";
export const REPLACE_PROMPT = "Importing replaces the wording you are editing, including changes you have not saved. Continue?";

type Props = {
  importAction: (formData: FormData) => Promise<ImportContractWordingState>;
  /** Whether the editor holds changes that are not saved. */
  dirty: boolean;
  /** Called with the imported form and the file's name once the import succeeded and the owner confirmed. */
  onImported: (form: ContractLayoutForm, fileName: string) => void;
};

/**
 * Reads an existing contract (docx or pdf) into the wording editor (contract-import S3, S4). It sits beside the editor's form, not in it,
 * and writes nothing: the result is handed to the editor as unsaved rows.
 */
export function ContractImportControl({ importAction, dirty, onImported }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [failure, setFailure] = useState<Extract<ImportContractWordingState, { status: "failed" }>["code"] | null>(null);
  const [pending, start] = useTransition();

  function run() {
    if (pending) return;
    const file = input.current?.files?.[0];
    const data = new FormData();
    if (file) data.set("file", file);
    start(async () => {
      const answer = await importAction(data);
      if (answer.status === "failed") {
        setFailure(answer.code);
        return;
      }
      setFailure(null);
      if (dirty && !window.confirm(REPLACE_PROMPT)) return;
      onImported(answer.form, file?.name ?? "your contract");
    });
  }

  return (
    <div className="flex max-w-3xl flex-col gap-2 rounded-control border border-hairline p-3">
      <label htmlFor="contract-import-file" className="text-[13px] font-medium text-ink">
        Import your existing contract (Word or PDF)
      </label>
      <input ref={input} id="contract-import-file" type="file" accept={CONTRACT_IMPORT_ACCEPT} disabled={pending} className="min-h-11 w-full text-[13px] text-ink-2" />
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" disabled={pending} onClick={run}>
          {pending ? "Reading…" : "Read my contract"}
        </Button>
        {pending && (
          <p role="status" className="text-[13px] text-ink-2">
            Claude is reading your contract. This can take up to a minute.
          </p>
        )}
      </div>
      {failure && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {IMPORT_MESSAGES[failure]}
        </p>
      )}
      <p className="text-[12px] text-ink-2">{IMPORT_NOTICE}</p>
    </div>
  );
}
