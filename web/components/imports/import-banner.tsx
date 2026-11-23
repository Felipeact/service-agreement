"use client";

import { useState, type ComponentProps, type DragEvent } from "react";
import { NewAgreementDialog } from "@/components/agreements/new-agreement-dialog";
import { useItemWords } from "@/components/shell/item-words";
import { UploadIcon } from "lucide-react";
import { IMPORT_ACCEPT } from "@/domain/imports";
import { itemText } from "@/domain/org-settings";

/**
 * The call to action at the top of the Imports page: drop a customer's equipment list here, or choose a file. Either
 * opens the New agreement dialog with the file already in it, so a list is never uploaded without a customer and a site
 * to put it on.
 */
export function ImportBanner(props: Omit<ComponentProps<typeof NewAgreementDialog>, "open" | "onClose" | "initialFile">) {
  const words = useItemWords();
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [over, setOver] = useState(false);

  function take(next: File | null | undefined) {
    if (!next) return;
    setFile(next);
    setOpen(true);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    take(event.dataTransfer.files?.[0]);
  }

  return (
    <>
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        data-import-banner
        className={`relative flex flex-col items-start gap-3 rounded-panel border p-5 shadow-card transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-action sm:flex-row sm:items-center ${
          over ? "border-action bg-action-tint" : "border-action/20 bg-linear-to-br from-action-tint to-surface"
        }`}
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-action text-surface shadow-md shadow-action/25">
          <UploadIcon aria-hidden="true" className="size-5" />
        </span>
        <div className="mr-auto flex min-w-0 flex-col">
          <p className="text-[15px] font-bold">{itemText("Start from the customer's equipment list", words)}</p>
          <p className="text-[13px] text-ink-nav">Drop an Excel, CSV, Word or PDF file and we write the service lines.</p>
        </div>
        <span className="inline-flex h-11 shrink-0 items-center justify-center rounded-control bg-action px-4 text-[13px] font-semibold text-surface shadow-md shadow-action/20 lg:h-10">
          Choose file
        </span>
        <input
          type="file"
          aria-label={itemText("Choose an equipment list", words)}
          accept={IMPORT_ACCEPT}
          onChange={(event) => {
            take(event.target.files?.[0]);
            event.target.value = "";
          }}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </div>
      <NewAgreementDialog {...props} open={open} initialFile={file} onClose={() => setOpen(false)} />
    </>
  );
}
