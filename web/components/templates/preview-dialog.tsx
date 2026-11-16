"use client";

import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import { TemplatePreviewFrame } from "./template-preview-frame";

export const PREVIEW_DIALOG_MESSAGES = { invalid: "Fix the highlighted blocks to preview." } as const;

type Props<V> = {
  values: V;
  /** The route that draws the PDF: the agreement's or the contract's. */
  endpoint: string;
  canDraw: (values: V) => boolean;
  frameTitle: string;
};

/**
 * The Preview PDF button and the dialog it opens (template-editor-v2 S4). The PDF is requested only while the dialog is open: the frame
 * inside it makes the request when it mounts, so a closed dialog costs nothing however much is typed. Escape and Close return focus.
 */
export function PreviewDialog<V>({ values, endpoint, canDraw, frameTitle }: Props<V>) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const closer = useRef<HTMLButtonElement>(null);

  const close = () => {
    setOpen(false);
    opener.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    closer.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        opener.current?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button type="button" ref={opener} onClick={() => setOpen(true)} aria-haspopup="dialog" className={buttonClass("secondary")}>
        Preview PDF
      </button>
      {open && (
        <div role="dialog" aria-modal="true" aria-label="PDF preview" className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col gap-3 overflow-y-auto rounded-panel bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-[18px] font-semibold tracking-tight">Preview PDF</h2>
              <button type="button" ref={closer} onClick={close} className={buttonClass("secondary")}>
                Close
              </button>
            </div>
            {canDraw(values) ? (
              <TemplatePreviewFrame values={values} endpoint={endpoint} canDraw={canDraw} frameTitle={frameTitle} />
            ) : (
              <p role="status" className="rounded-control bg-attention-bg px-3 py-3 text-[13px] font-medium text-attention-fg">
                {PREVIEW_DIALOG_MESSAGES.invalid}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
