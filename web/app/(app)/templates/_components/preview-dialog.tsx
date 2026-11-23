"use client";

import { useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { buttonClass } from "@/components/ui/button";
import { TemplatePreviewFrame } from "@/components/templates/template-preview-frame";

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

  const close = () => {
    setOpen(false);
    opener.current?.focus();
  };

  return (
    <>
      <button type="button" ref={opener} onClick={() => setOpen(true)} aria-haspopup="dialog" className={buttonClass("secondary")}>
        Preview PDF
      </button>
      <Modal open={open} onClose={close} title="Preview PDF" sub="The page your customer receives." wide>
        {canDraw(values) ? (
          <TemplatePreviewFrame values={values} endpoint={endpoint} canDraw={canDraw} frameTitle={frameTitle} />
        ) : (
          <p role="status" className="rounded-control bg-attention-bg px-3 py-3 text-[13px] font-medium text-attention-fg">
            {PREVIEW_DIALOG_MESSAGES.invalid}
          </p>
        )}
      </Modal>
    </>
  );
}
