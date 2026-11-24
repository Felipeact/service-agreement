"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";

type Props = {
  /** The route that draws the saved version as a PDF. */
  pdfPath: string;
  agreements: { id: string; label: string }[];
  /** The agreement it is drawn on, from the address; `null` for the sample. */
  agreementId: string | null;
  editHref: string | null;
  frameTitle: string;
  note: string;
};

/**
 * The preview page of a saved template (rich-templates): the PDF as the customer gets it, on sample data or on one of the org's own
 * agreements. The choice is kept in the address (`?agreement=`), so the page can be reloaded or shared with a colleague as it is.
 */
export function SavedPreview({ pdfPath, agreements, agreementId, editHref, frameTitle, note }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const src = agreementId ? `${pdfPath}?agreement=${encodeURIComponent(agreementId)}` : pdfPath;
  return (
    <section aria-label="Preview" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-panel border border-hairline bg-surface px-4 py-3 shadow-card">
        <label className="flex min-w-0 flex-1 basis-64 flex-col gap-1 text-[13px] font-medium text-ink">
          Show it with
          <select
            value={agreementId ?? ""}
            onChange={(event) => start(() => router.replace(event.target.value ? `?agreement=${encodeURIComponent(event.target.value)}` : "?", { scroll: false }))}
            className="min-h-11 w-full rounded-control border border-hairline bg-surface px-2 text-[14px] lg:min-h-9"
          >
            <option value="">Sample data</option>
            {agreements.map((agreement) => (
              <option key={agreement.id} value={agreement.id}>
                {agreement.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {pending && (
            <p role="status" className="text-[13px] text-ink-2">
              Drawing the PDF…
            </p>
          )}
          <a href={src} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary")}>
            Open the PDF
          </a>
          {editHref && (
            <LinkButton href={editHref} variant="primary">
              Edit
            </LinkButton>
          )}
        </div>
      </div>
      <p className="text-[12px] text-ink-2">{note}</p>
      <iframe key={src} title={frameTitle} src={`${src}#toolbar=0&view=FitH`} className="h-[78dvh] min-h-[28rem] w-full rounded-panel border border-hairline bg-ground shadow-card" />
    </section>
  );
}
