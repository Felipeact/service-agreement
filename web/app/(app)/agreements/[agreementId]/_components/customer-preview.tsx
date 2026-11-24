"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TEMPLATE_MESSAGES, type TemplateState } from "@/components/agreements/state";
import { PDF_PREVIEW_MESSAGES, usePdfDrawing } from "./agreement-pdf-preview";
import { panel, secondaryButton } from "./styles";
import type { TemplateChoice } from "./template-choice";

type Props = {
  agreementId: string;
  versionNo: number;
  /** Changes whenever what the PDF would say changes, so the preview redraws after an edit. */
  revision: string;
  /** Who reads it: the contact's name, else the customer's. */
  reader: string;
  templateName: string | null;
  /** The org's templates from the Templates page plus the built-in one; absent when the version cannot change template. */
  choices?: TemplateChoice[];
  selected?: string;
  change?: (templateVersionId: string) => Promise<TemplateState>;
};

/**
 * "What the customer gets" (approved design): the template as choice cards, picked in one tap, and below them the agreement's
 * own PDF, drawn by that template, in a frame on the board colour. The PDF starts drawing only when the section comes into
 * view (a large agreement takes seconds) and redraws after each edit. A phone cannot embed a PDF, so there it opens in a tab.
 */
export function CustomerPreview({ agreementId, versionNo, revision, reader, templateName, choices, selected, change }: Props) {
  const ref = useRef<HTMLElement>(null);
  // Without IntersectionObserver (an old browser) it draws at once; the markup is the same either way.
  const [isVisible, setIsVisible] = useState(() => typeof IntersectionObserver === "undefined");
  const [picked, setPicked] = useState(selected ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isChanging, startChanging] = useTransition();
  const { url, status, retry } = usePdfDrawing({ agreementId, versionNo, revision, enabled: isVisible });
  const pdfHref = `/agreements/${agreementId}/pdf?version=${versionNo}&inline=1`;

  useEffect(() => {
    const element = ref.current;
    if (!element || isVisible) return;
    const observer = new IntersectionObserver((entries) => entries.some((entry) => entry.isIntersecting) && setIsVisible(true), { rootMargin: "200px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, [isVisible]);

  function handlePick(versionId: string) {
    if (!change || versionId === picked) return;
    const previous = picked;
    setPicked(versionId);
    startChanging(async () => {
      const result = await change(versionId).catch(() => ({ status: "unavailable" }) as TemplateState);
      if (result.status !== "saved") {
        setPicked(previous);
        setMessage(result.status in TEMPLATE_MESSAGES ? TEMPLATE_MESSAGES[result.status as keyof typeof TEMPLATE_MESSAGES] : "The template could not be changed.");
      } else setMessage(null);
    });
  }

  const editable = change !== undefined && (choices?.length ?? 0) > 0;
  return (
    <section ref={ref} id="preview" aria-label="What the customer gets" className={`scroll-mt-20 overflow-hidden ${panel}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline px-5 py-3">
        <div>
          <h2 className="text-[16px] font-bold tracking-tight">What the customer gets</h2>
          <p className="text-[13px] text-ink-2">
            {`The agreement as ${reader} will see it${templateName ? `, in the ${templateName} template` : ""}, with every change above.`}
          </p>
        </div>
        <a href={pdfHref} target="_blank" rel="noopener noreferrer" className={secondaryButton}>
          Open as PDF
        </a>
      </div>

      {editable && (
        <fieldset className="border-b border-hairline px-5 py-4" disabled={isChanging}>
          <legend className="sr-only">Template</legend>
          <p className="mb-2 text-[13px] font-semibold">Template</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {choices!.map((candidate) => {
              const isPicked = candidate.versionId === picked;
              return (
                <label
                  key={candidate.versionId}
                  className={`flex min-h-11 cursor-pointer flex-col gap-0.5 rounded-control border px-3 py-2.5 text-[13px] ${isPicked ? "border-action bg-action-tint" : "border-hairline hover:bg-board"}`}
                >
                  <span className="flex items-center gap-2">
                    <input type="radio" name="template" value={candidate.versionId} checked={isPicked} onChange={() => handlePick(candidate.versionId)} className="size-4 accent-action" />
                    <span className="font-semibold">{candidate.name}</span>
                  </span>
                  {candidate.description && <span className="pl-6 text-[12px] text-ink-2">{candidate.description}</span>}
                </label>
              );
            })}
          </div>
          {message && (
            <p role="alert" className="mt-2 text-[13px] font-medium text-danger">
              {message}
            </p>
          )}
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-2">
            Your templates from the Templates page, plus the built-in one. The template sets the colour, font, opening text and which sections the customer sees.
            <Link href="/templates" className="inline-flex min-h-11 items-center font-semibold text-action hover:underline lg:min-h-0">
              Make or edit templates
            </Link>
          </p>
        </fieldset>
      )}

      <div className="flex flex-col gap-3 bg-board px-3 py-6 sm:px-8">
        <div role="status" aria-live="polite" className="flex min-h-5 flex-wrap items-center gap-x-3 text-[13px] text-ink-2">
          {(status === "drawing" || isChanging) && <span>{PDF_PREVIEW_MESSAGES.drawing}</span>}
          {status === "unavailable" && !isChanging && (
            <>
              <span>{PDF_PREVIEW_MESSAGES.unavailable}</span>
              <Button onClick={retry}>Try again</Button>
            </>
          )}
        </div>
        {url && (
          <iframe
            title={`What the customer gets, version ${versionNo}`}
            src={`${url}#toolbar=0&view=FitH`}
            className="mx-auto hidden h-[80dvh] min-h-[32rem] w-full max-w-[760px] rounded-[6px] bg-surface shadow-float md:block"
          />
        )}
        <p className="text-[13px] text-ink-2 md:hidden">A phone cannot show the PDF on the page. Open it as a PDF to read it.</p>
      </div>
    </section>
  );
}
