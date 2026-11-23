"use client";

import { useEffect, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";

export const PREVIEW_PANE_MESSAGES = {
  updating: "Drawing the PDF…",
  invalid: "Fix what the page lists under Before you save, then preview again.",
  unavailable: "The preview didn't draw.",
  missing: "That agreement can't be read any more. Choose another.",
} as const;

type Status = "updating" | "ready" | "invalid" | "unavailable" | "missing";

type Props<V> = {
  values: V;
  /** The route that draws the PDF: the agreement template's or the contract wording's. */
  endpoint: string;
  /** The org's recent agreements to draw the page on, besides the sample. */
  agreements: { id: string; label: string }[];
  /** The name the downloaded file gets. */
  fileName: string;
  frameTitle: string;
  /** One line under the controls on what this preview is. */
  note: string;
};

/**
 * The preview page (rich-templates): the PDF exactly as the customer gets it, drawn from what is on screen, saved or not. It is drawn on
 * sample data, or on one of the org's own agreements. One request at a time; a newer one cancels the last; object URLs are released.
 */
export function PreviewPane<V>({ values, endpoint, agreements, fileName, frameTitle, note }: Props<V>) {
  const [source, setSource] = useState("");
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("updating");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const query = source ? `?agreement=${encodeURIComponent(source)}` : "";
    async function draw() {
      setStatus("updating");
      try {
        const response = await fetch(`${endpoint}${query}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values), signal: controller.signal });
        if (controller.signal.aborted) return;
        if (response.status === 422) return setStatus("invalid");
        if (response.status === 404) return setStatus("missing");
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
  }, [values, source, attempt, endpoint]);

  useEffect(() => {
    if (url === null) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return (
    <section aria-label="Preview" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-panel border border-hairline bg-surface px-4 py-3 shadow-card">
        <label className="flex min-w-0 flex-1 basis-64 flex-col gap-1 text-[13px] font-medium text-ink">
          Show it with
          <select value={source} onChange={(event) => setSource(event.target.value)} className="min-h-11 w-full rounded-control border border-hairline bg-surface px-2 text-[14px] lg:min-h-9">
            <option value="">Sample data</option>
            {agreements.map((agreement) => (
              <option key={agreement.id} value={agreement.id}>
                {agreement.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <p role="status" aria-live="polite" className="text-[13px] text-ink-2">
            {status === "updating" && PREVIEW_PANE_MESSAGES.updating}
            {status === "invalid" && PREVIEW_PANE_MESSAGES.invalid}
            {status === "unavailable" && PREVIEW_PANE_MESSAGES.unavailable}
            {status === "missing" && PREVIEW_PANE_MESSAGES.missing}
          </p>
          {status === "unavailable" && <Button onClick={() => setAttempt((count) => count + 1)}>Try again</Button>}
          {url && (
            <>
              <a href={url} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
                Open the PDF
              </a>
              <a href={url} download={fileName} className={buttonClass("secondary")}>
                Download
              </a>
            </>
          )}
        </div>
      </div>
      <p className="text-[12px] text-ink-2">{note}</p>
      {url ? (
        <iframe title={frameTitle} src={`${url}#toolbar=0&view=FitH`} className="h-[75dvh] min-h-[28rem] w-full rounded-panel border border-hairline bg-ground shadow-card" />
      ) : (
        <div aria-hidden="true" className="h-[75dvh] min-h-[28rem] w-full animate-pulse rounded-panel border border-dashed border-hairline bg-ground motion-reduce:animate-none" />
      )}
    </section>
  );
}
