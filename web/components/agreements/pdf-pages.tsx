"use client";

import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";

export type PdfStatus = "idle" | "drawing" | "ready" | "unavailable";

/**
 * Loads pdf.js on first use only: it is large and only the document card and the viewer need it. The worker is bundled
 * next to it, so the page's main thread never parses the PDF.
 */
async function pdfjs() {
  const lib = await import("pdfjs-dist");
  if (!lib.GlobalWorkerOptions.workerSrc) {
    lib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  return lib;
}

/**
 * The PDF at `src`, fetched and opened while `enabled`. A response that is not a PDF (a redirect to sign-in answers HTML)
 * is `unavailable`. A new `src` replaces the open document and releases the old one; the last good one stays on screen
 * while the next is drawn, so an edit never blanks the preview.
 */
export function usePdfDocument(src: string, enabled: boolean) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [status, setStatus] = useState<PdfStatus>("idle");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let opened: PDFDocumentProxy | null = null;
    async function load() {
      setStatus("drawing");
      try {
        const response = await fetch(src, { signal: controller.signal });
        if (!response.ok || !(response.headers.get("Content-Type") ?? "").startsWith("application/pdf")) return setStatus("unavailable");
        const data = new Uint8Array(await response.arrayBuffer());
        if (controller.signal.aborted) return;
        const lib = await pdfjs();
        opened = await lib.getDocument({ data }).promise;
        if (controller.signal.aborted) {
          void opened.destroy();
          return;
        }
        setDoc((previous) => {
          if (previous && previous !== opened) void previous.destroy();
          return opened;
        });
        setStatus("ready");
      } catch {
        if (!controller.signal.aborted) setStatus("unavailable");
      }
    }
    void load();
    return () => controller.abort();
  }, [src, enabled, attempt]);

  // The last document is released when the component goes away.
  const docRef = useRef(doc);
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);
  useEffect(() => () => void docRef.current?.destroy(), []);

  return { doc, status, retry: () => setAttempt((count) => count + 1) };
}

type PageProps = {
  doc: PDFDocumentProxy;
  pageNo: number;
  /** The CSS width the page is drawn at; the canvas holds device pixels so text stays sharp. */
  width: number;
  label: string;
};

/** One page of the document as a white sheet, redrawn when the width or the document changes. */
export function PdfPage({ doc, pageNo, width, label }: PageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ratio, setRatio] = useState(11 / 8.5);

  useEffect(() => {
    let cancelled = false;
    let task: { cancel: () => void } | null = null;
    async function draw() {
      const page = await doc.getPage(pageNo);
      if (cancelled) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const scale = (width / base.width) * Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      const render = page.render({ canvas, viewport });
      task = render;
      try {
        await render.promise;
      } catch {
        // A cancelled render (the width changed mid-draw) is replaced by the next one.
      }
    }
    if (width > 0) void draw();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNo, width]);

  return (
    <div
      data-pdf-page={pageNo}
      className="relative bg-surface shadow-panel ring-1 ring-hairline"
      style={{ width, height: Math.round(width * ratio) }}
    >
      <canvas ref={canvasRef} role="img" aria-label={label} className="block size-full" />
    </div>
  );
}

/** The width of an element as it resizes, for drawing pages that fill it. */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}
