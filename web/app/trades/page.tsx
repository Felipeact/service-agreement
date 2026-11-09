import type { Metadata } from "next";
import { TRADE_PAGES } from "@/components/site/content";
import { CtaBand, PageHero, SectionHead, Wrap } from "@/components/site/sections";
import { SiteShell } from "@/components/site/site-shell";

export const metadata: Metadata = { title: "Trades" };

const IDEAS = [
  ["A pack is data, not code.", "Types, checklists, default visit months and the spellings your customers use. Once it is in your workspace, it is your copy to edit, add to or remove from."],
  ["Your own words for the item.", "Call them units, areas, zones or stations. One label drives the app, the PDFs and the customer's page."],
  ["Several trades, one workspace.", "Pick every trade you work in. Mixed contractors get every pack, and the first trade sets the vocabulary."],
] as const;

/** The starter packs and the "another trade" route (ROADMAP.md, Trades and packs). */
export default function TradesPage() {
  return (
    <SiteShell>
      <PageHero title="Your trade, set up on day one." text="Recurring service is the same job in every trade: a list of things, a checklist for each, and a cadence. You pick your trades when you register, and your workspace starts with theirs." />
      <section className="bg-surface">
        <Wrap className="grid gap-4 py-14 md:grid-cols-2 lg:py-20">
          {TRADE_PAGES.map((trade) => (
            <article key={trade.code} id={trade.code} className="flex flex-col gap-3 rounded-panel border border-hairline bg-ground p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold text-ink-2">{trade.status}</span>
                {trade.count && <span className="text-[12px] text-ink-2">{trade.count}</span>}
              </div>
              <h2 className="font-display text-[24px] font-semibold tracking-tight">{trade.name}</h2>
              <p className="text-ink-2">{trade.blurb}</p>
              <ul className="flex flex-wrap gap-1.5 pt-1">
                {trade.items.map((item) => (
                  <li key={item} className="rounded-control bg-surface px-2.5 py-1 text-[12px] font-medium">
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </Wrap>
      </section>
      <section className="bg-ground">
        <Wrap className="grid gap-8 py-14 lg:grid-cols-3 lg:py-20">
          <SectionHead title="Starter packs, then yours." className="lg:col-span-3" />
          {IDEAS.map(([title, text]) => (
            <div key={title} className="flex flex-col gap-1.5 border-t border-hairline pt-4">
              <h3 className="font-display text-[16px] font-semibold">{title}</h3>
              <p className="text-ink-2">{text}</p>
            </div>
          ))}
        </Wrap>
      </section>
      <CtaBand title="Pick your trades and start." />
    </SiteShell>
  );
}
