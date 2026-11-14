import type { Metadata } from "next";
import { CtaBand, PageHero, SectionHead, Wrap } from "@/components/site/sections";
import { SiteShell } from "@/components/site/site-shell";

export const metadata: Metadata = { title: "About" };

const PRINCIPLES = [
  ["You always know where a deal stands.", "Every agreement and contract has one clear state, how long it has been there, and what happens next."],
  ["Your customer's list can arrive messy.", "Send it as it came. Doubtful rows are flagged for you to review, and nobody retypes a spreadsheet."],
  ["Your customer sees your name.", "Anything your customer sees looks like it came from you, not from us."],
  ["One job, done thoroughly.", "From list to signature, in depth. Project contracts and field dispatch are out."],
  ["Everything leaves a record.", "Approvals, signatures and automated actions leave evidence you can show."],
] as const;

/** Honest about stage: no customers, results or team claims that do not exist (PRODUCT.md, Evidence on Hand). */
export default function AboutPage() {
  return (
    <SiteShell>
      <PageHero title="Service quotes should not live in spreadsheets." text="Service Agreement is a small, focused product for trade contractors who sell recurring service. It is built by Felipe Viana and is in active development." />
      <section className="bg-surface">
        <Wrap className="grid gap-8 py-14 lg:grid-cols-[1fr_1.4fr] lg:gap-14 lg:py-20">
          <SectionHead title="Why it exists." />
          <div className="flex max-w-[62ch] flex-col gap-4 text-[15px] leading-relaxed text-ink-2">
            <p>A recurring service agreement starts as a customer&apos;s list, usually a messy spreadsheet or a PDF. It then becomes a quote, a Word document, a pile of emails and, if it goes well, a signature. Every step is manual and any step can stall without anyone noticing.</p>
            <p>This product keeps the whole path in one place: import, price, send, follow up, sign and renew. It is aimed at small and mid-sized shops that do not want a full field-service suite.</p>
          </div>
        </Wrap>
      </section>
      <section className="bg-ground">
        <Wrap className="flex flex-col gap-8 py-14 lg:py-20">
          <SectionHead title="What we hold to." />
          <ul className="grid gap-x-8 gap-y-6 md:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map(([title, text]) => (
              <li key={title} className="flex flex-col gap-1.5 border-t border-hairline pt-4">
                <h3 className="font-display text-[16px] font-semibold">{title}</h3>
                <p className="text-ink-2">{text}</p>
              </li>
            ))}
          </ul>
        </Wrap>
      </section>
      <section className="bg-surface">
        <Wrap className="grid gap-8 py-14 lg:grid-cols-2 lg:py-20">
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-[22px] font-semibold tracking-tight">Where we are.</h2>
            <p className="max-w-[56ch] text-ink-2">The import, the agreement builder, the customer review page, e-signature and the automations are built and tested. We have no customers yet, so this site shows no quotes, logos or results. We are looking for the first contractors to shape it with.</p>
          </div>
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-[22px] font-semibold tracking-tight">Where it works.</h2>
            <p className="max-w-[56ch] text-ink-2">Canada outside Quebec at launch, in Canadian dollars. Quebec has its own e-signature framework and language rules and comes later.</p>
          </div>
        </Wrap>
      </section>
      <CtaBand title="Want to shape it with us?" text="Create a workspace, or write to us about your trade and the lists you quote from." />
    </SiteShell>
  );
}
