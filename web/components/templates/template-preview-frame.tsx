"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { previewBodyFromTemplateForm, type TemplateFormInput } from "@/domain/agreement/template-form";

/** How long the fields stay unchanged before a PDF is requested (template-flow AC 21). */
export const PREVIEW_DEBOUNCE_MS = 700;

export const PREVIEW_MESSAGES = {
  updating: "Updating preview…",
  invalid: "Fix the highlighted fields to refresh the preview.",
  unavailable: "Preview unavailable.",
  newTab: "Open the preview in a new tab",
} as const;

type Status = "idle" | "updating" | "invalid" | "unavailable";

/** The browser's own PDF viewer, without its toolbar and fitted to the width. */
const viewerSrc = (url: string) => `${url}#toolbar=0&view=FitH`;

type FrameProps<V> = {
  values: V;
  /** The route that draws the PDF; the agreement preview by default. */
  endpoint?: string;
  /** Whether the values can be drawn; the old agreement form's rules by default. */
  canDraw?: (values: V) => boolean;
  /** The title of the PDF frame, for assistive technology. */
  frameTitle?: string;
};

const ownForm = (values: unknown) => previewBodyFromTemplateForm(values as TemplateFormInput).ok;

/**
 * The PDF of the editor's current values, drawn beside the form (template-flow S4; block-editor S4 and S5 give it their own endpoint). One request at a time: a change
 * waits 700 ms, a newer change cancels the request before it, and the last good PDF stays on screen while the next is made or when
 * the values cannot be drawn. The object URLs it makes are released when replaced and when the editor goes away.
 */
export function TemplatePreviewFrame<V = TemplateFormInput>({ values, endpoint = "/templates/preview", canDraw = ownForm, frameTitle = "Agreement PDF preview" }: FrameProps<V>) {
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [attempt, setAttempt] = useState(0);
  const requested = useRef(false);
  const retrying = useRef(false);
  const valid = useMemo(() => canDraw(values), [canDraw, values]);

  useEffect(() => {
    // Values that cannot be drawn make no request; the cleanup of the run before has already cancelled one in flight.
    if (!valid) return;
    const controller = new AbortController();
    // The first request, and a retry, go at once, so a saved or new template shows its PDF without an edit; later ones wait for the typing to stop.
    const delay = requested.current && !retrying.current ? PREVIEW_DEBOUNCE_MS : 0;
    retrying.current = false;
    async function draw() {
      requested.current = true;
      setStatus("updating");
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        // A redirect to the sign-in page answers 200 with HTML: only a PDF is a preview.
        if (response.status === 422) return setStatus("invalid");
        if (!response.ok || !(response.headers.get("Content-Type") ?? "").startsWith("application/pdf")) return setStatus("unavailable");
        const blob = await response.blob();
        if (controller.signal.aborted) return;
        setUrl(URL.createObjectURL(blob));
        setStatus("idle");
      } catch {
        if (!controller.signal.aborted) setStatus("unavailable");
      }
    }
    const timer = delay === 0 ? undefined : setTimeout(draw, delay);
    if (delay === 0) void draw();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [values, valid, attempt, endpoint]);

  const shown: Status = valid ? status : "invalid";

  // The previous PDF's address is released once the next one has replaced it, and the last one when the editor goes away.
  useEffect(() => {
    if (url === null) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return (
    <section aria-label="Preview" className="flex min-w-0 flex-col gap-3 rounded-panel border border-hairline bg-surface p-4 shadow-card xl:sticky xl:top-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="font-display text-[16px] font-semibold tracking-tight">Preview</h2>
        <div role="status" aria-live="polite" className="flex min-h-5 flex-wrap items-center gap-x-3 text-[13px] text-ink-2">
          {shown === "updating" && <span>{PREVIEW_MESSAGES.updating}</span>}
          {shown === "invalid" && <span>{PREVIEW_MESSAGES.invalid}</span>}
          {shown === "unavailable" && (
            <>
              <span>{PREVIEW_MESSAGES.unavailable}</span>
              <Button
                onClick={() => {
                  retrying.current = true;
                  setAttempt((count) => count + 1);
                }}
              >
                Try again
              </Button>
            </>
          )}
        </div>
      </div>
      {url ? (
        <iframe title={frameTitle} src={viewerSrc(url)} className="h-[70dvh] min-h-[24rem] w-full rounded-control border border-hairline bg-ground xl:h-[calc(100dvh-9rem)]" />
      ) : (
        <div aria-hidden="true" className="h-[24rem] w-full rounded-control border border-dashed border-hairline bg-ground xl:h-[calc(100dvh-9rem)]" />
      )}
      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-[13px] font-medium text-action lg:min-h-0">
          {PREVIEW_MESSAGES.newTab}
        </a>
      )}
    </section>
  );
}
