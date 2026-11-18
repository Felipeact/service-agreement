"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { PdfPage, usePdfDocument, useWidth } from "./pdf-pages";

export const PDF_PREVIEW_MESSAGES = {
  drawing: "Drawing the document…",
  unavailable: "The document could not be drawn.",
  open: "Preview",
  download: "Download PDF",
} as const;

type Props = {
  agreementId: string;
  /** The version on screen; the PDF is of this one. */
  versionNo: number;
  /** Changes whenever what the PDF would say changes (lines, term, total), so the document redraws after an edit. */
  revision: string;
  /** The agreement number, for the viewer's title. */
  number?: string;
};

/** Letter width at 96 dpi: the viewer never draws a page wider than the paper at 100%. */
const PAPER_WIDTH = 816;
const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/**
 * The agreement as the customer will get it. A card shows the first page and the page count, drawn with pdf.js on a canvas
 * so it reads the same on a phone as on a desktop (the browser's own PDF frame shows nothing on most phones). "Preview" opens
 * every page in a full-screen viewer with zoom; "Download PDF" saves the same file.
 */
export function AgreementPdfPreview({ agreementId, versionNo, revision, number }: Props) {
  const [open, setOpen] = useState(false);
  const src = `/agreements/${agreementId}/pdf?version=${versionNo}&inline=1&r=${encodeURIComponent(revision)}`;
  const download = `/agreements/${agreementId}/pdf?version=${versionNo}`;
  const { doc, status, retry } = usePdfDocument(src, true);
  const [thumbRef, thumbWidth] = useWidth<HTMLDivElement>();
  const pages = doc?.numPages ?? 0;

  return (
    <section aria-label="PDF preview" className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface p-4 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-[16px] font-semibold tracking-tight">Document</h2>
        <p role="status" aria-live="polite" className="text-[12px] text-ink-2">
          {status === "drawing" && !doc && PDF_PREVIEW_MESSAGES.drawing}
          {status === "unavailable" && PDF_PREVIEW_MESSAGES.unavailable}
          {doc && `${pages} ${pages === 1 ? "page" : "pages"}${status === "drawing" ? " · updating…" : ""}`}
        </p>
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!doc}
        aria-label={`Preview the document, version ${versionNo}`}
        className="group relative flex max-h-60 justify-center overflow-hidden rounded-control bg-board px-6 pt-5 disabled:cursor-default"
      >
        <div ref={thumbRef} className="w-full max-w-[13rem]">
          {doc ? (
            <div className="transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1 group-enabled:group-hover:shadow-lift">
              <PdfPage doc={doc} pageNo={1} width={thumbWidth} label={`Page 1 of the agreement, version ${versionNo}`} />
            </div>
          ) : (
            <div aria-hidden="true" className={`aspect-[8.5/11] w-full bg-surface shadow-card ${status === "drawing" ? "animate-pulse" : ""}`} />
          )}
        </div>
        {/* The sheet runs off the bottom of the well, as paper on a desk: only its top is shown. */}
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-hairline" />
      </button>

      <div className="flex flex-wrap gap-2">
        {status === "unavailable" ? (
          <Button onClick={retry}>Try again</Button>
        ) : (
          <Button onClick={() => setOpen(true)} disabled={!doc} className="flex-1">
            <Icon name="eye" className="size-4" />
            {PDF_PREVIEW_MESSAGES.open}
          </Button>
        )}
        {/* A file download, not a page: a plain anchor so the browser saves it. */}
        <a
          href={download}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-control border border-hairline bg-surface px-4 text-[13px] font-semibold whitespace-nowrap text-ink transition-colors duration-150 hover:bg-ground lg:h-[34px]"
        >
          <Icon name="download" className="size-4" />
          {PDF_PREVIEW_MESSAGES.download}
        </a>
      </div>

      {open && doc && (
        <DocumentViewer
          doc={doc}
          title={number ? `${number} · Version ${versionNo}` : `Version ${versionNo}`}
          download={download}
          redrawing={status === "drawing"}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

type ViewerProps = {
  doc: NonNullable<ReturnType<typeof usePdfDocument>["doc"]>;
  title: string;
  download: string;
  redrawing: boolean;
  onClose: () => void;
};

/** Every page, full screen, with zoom and the page in view; Escape or Close leaves it. */
function DocumentViewer({ doc, title, download, redrawing, onClose }: ViewerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [scrollRef, areaWidth] = useWidth<HTMLDivElement>();
  const [zoom, setZoom] = useState<(typeof ZOOMS)[number]>(1);
  const [current, setCurrent] = useState(1);
  const pages = doc.numPages;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // The page in view is the one whose sheet holds the middle of the scroll area.
  useEffect(() => {
    const area = scrollRef.current;
    if (!area) return;
    function track() {
      const middle = area!.getBoundingClientRect().top + area!.clientHeight / 2;
      const sheets = [...area!.querySelectorAll<HTMLElement>("[data-pdf-page]")];
      const hit = sheets.find((sheet) => sheet.getBoundingClientRect().bottom >= middle);
      if (hit) setCurrent(Number(hit.dataset.pdfPage));
    }
    area.addEventListener("scroll", track, { passive: true });
    return () => area.removeEventListener("scroll", track);
  }, [scrollRef]);

  const fit = Math.max(0, Math.min(areaWidth - 32, PAPER_WIDTH));
  const width = Math.round(fit * zoom);
  const step = (direction: 1 | -1) => setZoom((now) => ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.indexOf(now) + direction))]);

  return (
    <dialog
      ref={dialogRef}
      aria-label={`Document preview, ${title}`}
      onClose={onClose}
      className="m-0 h-dvh max-h-none w-screen max-w-none bg-board p-0 text-ink backdrop:bg-ink/50 lg:m-auto lg:h-[calc(100dvh-3rem)] lg:w-[min(64rem,calc(100vw-3rem))] lg:rounded-panel lg:shadow-panel"
    >
      <div className="flex h-full flex-col">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-hairline bg-surface px-3 py-2 sm:px-4">
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="truncate font-display text-[15px] font-semibold tracking-tight">{title}</h2>
            <p role="status" aria-live="polite" className="text-[12px] text-ink-2">
              {`Page ${current} of ${pages}`}
              {redrawing && " · updating…"}
            </p>
          </div>
          <div className="flex items-center gap-1" role="group" aria-label="Zoom">
            <button type="button" onClick={() => step(-1)} disabled={zoom === ZOOMS[0]} aria-label="Zoom out" className={iconButton}>
              <Icon name="minus" className="size-4" />
            </button>
            <button type="button" onClick={() => setZoom(1)} className="h-11 min-w-14 rounded-control px-2 text-[12px] font-semibold text-ink-2 hover:bg-ground lg:h-[34px]" aria-label="Fit to width">
              {`${Math.round(zoom * 100)}%`}
            </button>
            <button type="button" onClick={() => step(1)} disabled={zoom === ZOOMS[ZOOMS.length - 1]} aria-label="Zoom in" className={iconButton}>
              <Icon name="plus" className="size-4" />
            </button>
          </div>
          <a href={download} aria-label="Download PDF" className={iconButton}>
            <Icon name="download" className="size-4" />
          </a>
          <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Close preview" className={iconButton}>
            <Icon name="close" className="size-4" />
          </button>
        </header>
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <div className="flex min-w-full flex-col items-center gap-5 px-4 py-5 sm:gap-6 sm:py-8" style={{ width: width + 32 > areaWidth ? width + 32 : undefined }}>
            {Array.from({ length: pages }, (_, index) => (
              <PdfPage key={index + 1} doc={doc} pageNo={index + 1} width={width} label={`Page ${index + 1} of ${pages}`} />
            ))}
          </div>
        </div>
      </div>
    </dialog>
  );
}

const iconButton =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-control text-ink-2 transition-colors duration-150 hover:bg-ground hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent lg:size-[34px]";
