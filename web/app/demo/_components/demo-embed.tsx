"use client";

import { Maximize2Icon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const DEMO_URL = "https://app.supademo.com/embed/cmwv0tzaz01m5qmm1eq1d2ekm?embed_v=2&utm_source=embed";

const BUTTON = "inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold transition-colors";

/**
 * The guided product demo (a Supademo walkthrough of equipment intake), shown above the hands-on steps. It is the third party's
 * own embed, loaded only when it scrolls into view; the page works without it.
 *
 * The embed draws its own rounded frame with a margin, so this wrapper adds no border or background (no box inside a box) and
 * pulls out to the page edge by about that margin, never cropping it.
 *
 * "Maximize" fills the screen with the same player. The wrapper is one native `<dialog>`: open in the page's flow, and re-opened
 * as a modal for Maximize. A modal dialog is drawn in the browser's top layer, above the sticky header whatever the page's
 * stacking, it traps focus and Escape closes it, and because it is the same element the iframe stays mounted and the demo does
 * not restart. Close, Escape and a tap on Close all put it back inline; the page behind does not scroll meanwhile and focus
 * returns to the button. Nothing depends on hover.
 */
export function DemoEmbed() {
  const [isExpanded, setIsExpanded] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  /** Set while this component itself closes the dialog to switch modes, so the `close` event it causes is not read as "the user closed it". */
  const isSwitching = useRef(false);

  useEffect(() => {
    if (!isExpanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isExpanded]);

  /** Re-opens the dialog in the other mode: closed first, because a dialog that is already open cannot be opened again. */
  function reopen(asModal: boolean) {
    const dialog = dialogRef.current;
    if (!dialog) return;
    isSwitching.current = true;
    dialog.close();
    if (asModal) dialog.showModal();
    else dialog.show();
    setIsExpanded(asModal);
    // The `close` event is queued by `close()`; it is read after this has run.
    setTimeout(() => {
      isSwitching.current = false;
      toggleRef.current?.focus();
    }, 0);
  }

  function handleClose() {
    // Escape (or the browser) closed the modal: put the player back inline instead of leaving it hidden.
    if (isSwitching.current) return;
    reopen(false);
  }

  return (
    <dialog
      ref={dialogRef}
      open
      aria-label="Product demo"
      onClose={handleClose}
      className="relative m-0 flex w-full max-w-none flex-col gap-2 border-0 bg-transparent p-0 text-inherit [&:modal]:h-dvh [&:modal]:max-h-none [&:modal]:w-dvw [&:modal]:bg-slate-950/90 [&:modal]:p-3 sm:[&:modal]:p-6 [&::backdrop]:bg-slate-950/90"
    >
      <div className="flex justify-end">
        <button
          ref={toggleRef}
          type="button"
          aria-pressed={isExpanded}
          onClick={() => reopen(!isExpanded)}
          className={`${BUTTON} ${isExpanded ? "bg-white text-slate-900 hover:bg-slate-100" : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
        >
          {isExpanded ? <XIcon aria-hidden="true" className="size-4" /> : <Maximize2Icon aria-hidden="true" className="size-4" />}
          {isExpanded ? "Close" : "Maximize"}
        </button>
      </div>
      <div className={isExpanded ? "relative min-h-0 w-full flex-1" : "relative -mx-2 aspect-4/3 max-h-[80svh] sm:-mx-8 sm:aspect-2/1"}>
        <iframe
          src={DEMO_URL}
          title="Product demo: create service agreements in minutes"
          loading="lazy"
          allow="clipboard-write"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      </div>
    </dialog>
  );
}
