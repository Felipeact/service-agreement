"use client";

import { useEffect, useState } from "react";

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
 * Draws the PDF of a version while `enabled`: fetches it, keeps the last good one on screen while the next draws, and releases
 * each object URL it makes. It redraws when the version or the content (`revision`) changes, or on `retry`.
 */
export function usePdfDrawing({ agreementId, versionNo, revision, enabled }: Props & { enabled: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>("drawing");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled, agreementId, versionNo, revision, attempt]);

  // The previous PDF's address is released once the next one has replaced it, and the last one when the page goes away.
  useEffect(() => {
    if (url === null) return;
    return () => URL.revokeObjectURL(url);
  }, [url]);

  return { url, status, retry: () => setAttempt((count) => count + 1) };
}
