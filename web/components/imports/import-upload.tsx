"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type FormEvent } from "react";
import { IMPORT_ACCEPT, IMPORT_MESSAGES, validateImportFile } from "@/domain/imports";
import { itemText } from "@/domain/org-settings";
import { useItemWords } from "@/components/shell/item-words";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/ui/file-dropzone";
import { uploadFile, uploadMessage, type ConfirmState, type ReadState, type StartState, type UploadState } from "./state";

type FieldsProps = {
  state: UploadState;
  /** The chosen file's name, kept visible while uploading and after a failure. */
  fileName: string | null;
  onChoose?: (file: File | null) => void;
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void;
  formRef?: React.Ref<HTMLFormElement>;
};

/** The picker, the hint, the failure message and Upload. Presentational: the caller owns the state. */
export function ImportUploadFields({ state, fileName, onChoose, onSubmit, formRef }: FieldsProps) {
  const words = useItemWords();
  const reading = state.status === "reading";
  const uploading = state.status === "uploading" || reading;
  const found = uploadMessage(state);
  const message = found && itemText(found, words);
  return (
    <form ref={formRef} onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-3 rounded-panel border border-hairline bg-surface p-4">
      <FileDropzone
        id="importFile"
        label={itemText("Equipment list", words)}
        accept={IMPORT_ACCEPT}
        hint="Excel, CSV, Word or PDF, up to 20 MB"
        file={fileName ? { name: fileName } : null}
        disabled={uploading}
        onFile={(file) => onChoose?.(file)}
      />
      {message && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {message}
        </p>
      )}
      <div>
        <Button type="submit" variant="primary" disabled={uploading}>
          {reading ? "Reading…" : uploading ? "Uploading…" : "Upload"}
        </Button>
      </div>
    </form>
  );
}

type UploaderProps = {
  start: (formData: FormData) => Promise<StartState>;
  confirm: (jobId: string) => Promise<ConfirmState>;
  read: (jobId: string) => Promise<ReadState>;
};

/** A file once stored is done with the form: what the read found shows on its job. */
const STORED = new Set<UploadState["status"]>(["parsed", "unreadable", "read_failed"]);

export function ImportUploader({ start, confirm, read }: UploaderProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>({ status: "idle" });
  const [uploading, startTransition] = useTransition();
  const [reading, setReading] = useState(false);

  function choose(next: File | null) {
    setFile(next);
    setState({ status: "idle" });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (uploading) return;
    // No file chosen gets the extension message: it names what to choose.
    if (!file) return setState({ status: "invalid", message: IMPORT_MESSAGES.extension });
    const checked = validateImportFile({ name: file.name, size: file.size });
    if (!checked.ok) return setState({ status: "invalid", message: checked.message });

    // Server Actions called from an event handler run inside a transition (Next server-actions guide).
    let stored = false;
    startTransition(async () => {
      const outcome = await uploadFile(file, {
        start,
        confirm,
        read,
        fetch: globalThis.fetch.bind(globalThis),
        onReading: () => {
          stored = true;
          setReading(true);
        },
      });
      // After the file is stored, an unexpected error can only be the read's: the job stays "Uploaded" with Read file.
      const result: UploadState = stored && outcome.status === "unavailable" ? { status: "read_failed" } : outcome;
      startTransition(() => {
        setReading(false);
        setState(result);
        if (STORED.has(result.status)) {
          formRef.current?.reset();
          setFile(null);
        }
        // readImportAction refreshes the page after a read; otherwise the list re-reads here, since a failed upload
        // leaves its job "Upload not finished". Refreshing twice would cut off the first refresh's request.
        if (result.status !== "parsed" && result.status !== "unreadable") router.refresh();
      });
    });
  }

  return (
    <ImportUploadFields
      state={uploading ? { status: reading ? "reading" : "uploading" } : state}
      fileName={file?.name ?? null}
      onChoose={choose}
      onSubmit={submit}
      formRef={formRef}
    />
  );
}
