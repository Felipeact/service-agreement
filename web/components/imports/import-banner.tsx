"use client";

import { useState, type ComponentProps, type DragEvent } from "react";
import { NewAgreementDialog } from "@/components/agreements/new-agreement-dialog";
import { useItemWords } from "@/components/shell/item-words";
import { Spot } from "@/components/ui/illustrations";
import { FILE_HINT } from "@/components/agreements/new-agreement-state";
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
        className={`relative flex flex-col items-start gap-4 rounded-panel border-2 border-dashed p-5 transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-action sm:flex-row sm:items-center ${
          over ? "border-action bg-action-tint" : "border-field bg-surface hover:bg-ground"
        }`}
      >
        <Spot kind="sheet" className="size-14 text-ink-2" />
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="font-display text-[17px] font-semibold tracking-tight">{itemText("Drop a customer equipment list here", words)}</p>
          <p className="text-[13px] text-ink-2">{FILE_HINT}. We keep every row and flag what we are unsure of for review.</p>
        </div>
        <span className="inline-flex h-11 shrink-0 items-center justify-center rounded-control border border-hairline bg-surface px-4 text-[13px] font-semibold text-ink shadow-card lg:h-[34px]">
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
