"use client";

import { XIcon } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** One quiet line under the title. */
  sub?: string;
  children: ReactNode;
  /** A wide modal for a document preview. */
  wide?: boolean;
};

/**
 * The modal every confirmation, preview and quick look uses (docs/DESIGN.md "Modals"): a native `<dialog>` opened as a modal
 * while `open`, a header bar with the title, a note and a close button, then a scrolling body. It closes on Escape, on its
 * close button and on a tap outside it, and the browser returns focus to what opened it.
 */
export function Modal({ open, onClose, title, sub, children, wide = false }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // A browser opens it as a true modal; an environment without the method (a test DOM) gets the attribute.
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);
  // Closed, it leaves nothing in the page; opened, the dialog mounts and the effect above shows it.
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => event.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? "max-w-3xl" : "max-w-lg"} rounded-panel border border-hairline bg-surface p-0 text-ink shadow-panel backdrop:bg-ink/40`}
    >
      <div className="flex items-start gap-3 border-b border-hairline px-5 py-4">
        <div className="mr-auto">
          <h2 id={titleId} className="text-[17px] font-bold tracking-tight">
            {title}
          </h2>
          {sub && <p className="text-[13px] text-ink-2">{sub}</p>}
        </div>
        <button type="button" onClick={onClose} className="inline-flex h-11 min-w-11 items-center justify-center rounded-control text-ink-2 hover:bg-board hover:text-ink lg:h-8 lg:min-w-8">
          <XIcon aria-hidden="true" className="size-4" />
          <span className="sr-only">Close</span>
        </button>
      </div>
      <div className="max-h-[70dvh] overflow-y-auto px-5 py-4">{children}</div>
    </dialog>
  );
}
