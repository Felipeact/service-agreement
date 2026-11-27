"use client";

import { useEffect, useRef, useState } from "react";
import "swagger-ui-dist/swagger-ui.css";
import "./swagger-theme.css";

type SwaggerBundle = (options: { spec: Record<string, unknown>; domNode: HTMLElement; docExpansion: string; defaultModelsExpandDepth: number; deepLinking: boolean; tryItOutEnabled: boolean }) => unknown;

/**
 * Swagger UI for the server's OpenAPI document. It uses the prebuilt bundle, loaded in the browser after the page shows: the
 * npm React wrapper trips over Turbopack's module graph when an operation opens.
 */
export function SwaggerReference({ spec }: { spec: Record<string, unknown> }) {
  const container = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  useEffect(() => {
    let isCancelled = false;
    import("swagger-ui-dist/swagger-ui-bundle.js")
      .then((module) => {
        if (isCancelled || !container.current) return;
        const bundle = ((module as { default?: unknown }).default ?? module) as SwaggerBundle;
        bundle({ spec, domNode: container.current, docExpansion: "list", defaultModelsExpandDepth: -1, deepLinking: false, tryItOutEnabled: true });
        setStatus("ready");
      })
      .catch(() => {
        if (!isCancelled) setStatus("failed");
      });
    return () => {
      isCancelled = true;
    };
  }, [spec]);

  return (
    <div data-slot="swagger" className="min-w-0 overflow-hidden rounded-panel border border-hairline bg-surface p-2 sm:p-4">
      {status === "loading" && (
        <p role="status" className="p-2 text-[13px] text-ink-2">
          Loading the reference…
        </p>
      )}
      {status === "failed" && (
        <p role="alert" className="p-2 text-[13px] text-danger">
          The reference could not load. Reload the page, or read the endpoint list on the public API page.
        </p>
      )}
      <div ref={container} />
    </div>
  );
}
