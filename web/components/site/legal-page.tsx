import type { ReactNode } from "react";
import { Wrap } from "./sections";
import { SiteShell } from "./site-shell";

export type LegalSection = { heading: string; body: readonly ReactNode[] };

/** The notice every legal page carries until a lawyer has reviewed the text. */
export const LEGAL_NOTICE = "Starter text, pending review by a lawyer";

/** A plain-text legal page: a title, the starter-text notice, then numbered sections. Static, so it prerenders. */
export function LegalPage({ title, intro, updated, sections }: { title: string; intro: string; updated: string; sections: readonly LegalSection[] }) {
  return (
    <SiteShell>
      <section className="bg-ground">
        <Wrap className="flex flex-col gap-4 pt-10 pb-8 lg:pt-16 lg:pb-10">
          <h1 className="font-display text-[34px] leading-[1.05] font-semibold tracking-tight text-balance lg:text-[48px]">{title}</h1>
          <p className="max-w-[62ch] text-[16px] leading-relaxed text-pretty text-ink-2">{intro}</p>
          <p role="note" className="w-fit max-w-full rounded-control border border-hairline bg-surface px-3 py-2 text-[13px] font-medium text-ink">
            {LEGAL_NOTICE}. Last updated {updated}.
          </p>
        </Wrap>
      </section>
      <section className="bg-surface">
        <Wrap className="flex max-w-[78ch] flex-col gap-8 py-10 lg:py-14">
          {sections.map((section, index) => (
            <div key={section.heading} className="flex flex-col gap-2">
              <h2 className="font-display text-[20px] font-semibold tracking-tight">
                {index + 1}. {section.heading}
              </h2>
              {section.body.map((paragraph, i) => (
                <p key={i} className="text-[15px] leading-relaxed text-ink-2">
                  {paragraph}
                </p>
              ))}
            </div>
          ))}
        </Wrap>
      </section>
    </SiteShell>
  );
}
