"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const PDF_PREVIEW_MESSAGES = {
  drawing: "Drawing the PDF…",
  unavailable: "The preview could not be drawn.",
  newTab: "Open in a new tab",
} as const;

type Status = "drawing" | "ready" | "unavailable";

type Props = {
  agreementId: string;
  /** The version on screen; the PDF is of this one. */
  versionNo: number;
  /** Changes whenever what the PDF would say changes (lines, term, total), so an open preview redraws after an edit. */
  revision: string;
};

/**
 * The agreement as the customer will get it, drawn on the page instead of downloaded. Nothing is requested until the member asks
 * (a large agreement takes seconds to draw); once open it redraws when the version or the content changes, keeps the last good
 * PDF on screen meanwhile, and releases each object URL it makes. The browser's own viewer shows it; on a phone, which cannot
 * embed a PDF well, "Open in a new tab" is the way in.
 */
export function AgreementPdfPreview({ agreementId, versionNo, revision }: Props) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("drawing");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    async function draw() {
      setStatus("drawing");
      try {
        const response = await fetch(`/agreements/${agreementId}/pdf?version=${versionNo}&inline=1&r=${encodeURIComponent(revision)}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        // A redirect to the sign-in page answers 200 with HTML: only a PDF is a preview.
        if (!response.ok || !(response.headers.get("Content-Type") ?? "").startsWith("application/pdf")) return setStatus("unavailable");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        setUrl(URL.createObjectURL(blob));
        setStatus("ready");
      } catch {
        if (!controller.signal.aborted) setStatus("unavailable");
      }
    }
    void draw();
    return () => controller.abort();
  }, [open, agreementId, versionNo, revision, attempt]);

  // The previous PDF's address is released once the next one has replaced it, and the last one when the page goes away.
  useEffect(() => {
    if (url === null) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return (
    <section aria-label="PDF preview" className="flex flex-col gap-3 rounded-panel border border-hairline bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <h2 className="font-display text-[16px] font-semibold tracking-tight">PDF preview</h2>
        <div role="status" aria-live="polite" className="flex min-h-5 flex-wrap items-center gap-x-3 text-[13px] text-ink-2">
          {open && status === "drawing" && <span>{PDF_PREVIEW_MESSAGES.drawing}</span>}
          {open && status === "unavailable" && (
            <>
              <span>{PDF_PREVIEW_MESSAGES.unavailable}</span>
              <Button onClick={() => setAttempt((count) => count + 1)}>Try again</Button>
            </>
          )}
        </div>
        <div className="sm:ml-auto">
          <Button
            variant={open ? undefined : "primary"}
            onClick={() => {
              setOpen((was) => !was);
            }}
            aria-expanded={open}
          >
            {open ? "Hide preview" : "Preview PDF"}
          </Button>
        </div>
      </div>
      {open && url && (
        <>
          <iframe title={`Agreement PDF, version ${versionNo}`} src={`${url}#toolbar=0&view=FitH`} className="hidden h-[75dvh] min-h-[28rem] w-full rounded-control border border-hairline bg-ground md:block" />
          <p className="text-[13px] text-ink-2 md:hidden">Phones cannot show a PDF on the page. Open it in a new tab to read it.</p>
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-[13px] font-medium text-action lg:min-h-0">
            {PDF_PREVIEW_MESSAGES.newTab}
          </a>
        </>
      )}
    </section>
  );
}
