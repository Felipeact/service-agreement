"use client";

import { useRef, useState, type DragEvent } from "react";
import { useItemWords } from "@/components/shell/item-words";
import { itemText } from "@/domain/org-settings";
import { Spot } from "./illustrations";

type FileDropzoneProps = {
  id: string;
  /** The visible name of the field above the zone. */
  label: string;
  accept: string;
  /** What the zone accepts, said once under the call to action (e.g. "Excel, CSV, Word or PDF, up to 20 MB"). */
  hint: string;
  /** The chosen file; only its name is shown. */
  file: { name: string } | null;
  /** A problem with the chosen file, shown under the zone and announced with it. */
  error?: string | null;
  disabled?: boolean;
  onFile: (file: File | null) => void;
  /** Human-readable size of the chosen file; the caller formats it. */
  sizeLabel?: string;
};

/**
 * A drop target and a file picker in one: the native input covers the whole zone, so a click, a tap, a keyboard
 * activation and a drop all reach the same control. The zone names what to do ("Drag an equipment list here") and,
 * once a file is chosen, names the file with a way to remove it.
 */
export function FileDropzone({ id, label, accept, hint, file, error, disabled = false, onFile, sizeLabel }: FileDropzoneProps) {
  const words = useItemWords();
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    if (disabled) return;
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) onFile(dropped);
  }

  function remove() {
    onFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const tone = over
    ? "border-action bg-action-tint"
    : file
      ? "border-action/60 bg-action-tint/50"
      : error
        ? "border-danger bg-surface"
        : "border-field bg-ground hover:bg-board/60";

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          if (!disabled) setOver(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        data-dropzone
        className={`relative flex flex-col items-center gap-1.5 rounded-panel border-2 border-dashed px-4 py-5 text-center transition-colors duration-150 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-action ${tone} ${disabled ? "opacity-60" : ""}`}
      >
        <input
          ref={inputRef}
          id={id}
          name="file"
          type="file"
          accept={accept}
          disabled={disabled}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
          aria-invalid={error ? true : undefined}
          onChange={(event) => onFile(event.target.files?.[0] ?? null)}
          className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        />
        <Spot kind="sheet" className="size-14 text-ink-2" />
        {file ? (
          <>
            <p className="text-[13.5px] font-semibold break-all text-ink">{file.name}</p>
            <p className="text-[12px] text-ink-2">{sizeLabel ? `${sizeLabel} · ` : ""}Drop or choose another file to replace it</p>
            <button
              type="button"
              onClick={remove}
              disabled={disabled}
              className="relative z-10 inline-flex min-h-11 items-center rounded-control px-3 text-[13px] font-medium text-action hover:bg-surface lg:min-h-[34px]"
            >
              Remove file
            </button>
          </>
        ) : (
          <>
            <p className="text-[13.5px] font-semibold text-ink">
              {itemText("Drag an equipment list here", words)} <span className="font-normal text-ink-2">or</span> <span className="text-action">choose a file</span>
            </p>
            <p id={hintId} className="text-[12px] text-ink-2">
              {hint}
            </p>
          </>
        )}
        {file && (
          <span id={hintId} className="sr-only">
            {hint}
          </span>
        )}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-[12px] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
