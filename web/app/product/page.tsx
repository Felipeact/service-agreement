import type { Metadata } from "next";
import { NOT_IN_PRODUCT } from "@/components/site/content";
import { AgreementMock, BoardMock, ScheduleMock } from "@/components/site/mock-ui";
import { CtaBand, FeatureGrid, PageHero, SectionHead, StepsGrid, Wrap } from "@/components/site/sections";
import { SiteShell } from "@/components/site/site-shell";

export const metadata: Metadata = { title: "Product" };

/** How a deal moves, what each part does, what the customer sees and what the product is not. */
export default function ProductPage() {
  return (
    <SiteShell>
      <PageHero title="One job, from list to signature." text="Service Agreement takes a trade contractor from the list of things a customer wants serviced to a signed recurring contract. It does that one job thoroughly." />
      <section className="bg-surface">
        <Wrap className="flex flex-col gap-8 py-14 lg:py-20">
          <SectionHead title="How a deal moves." text="Six steps, each with an owner. Your team does the first two, the app and the customer do most of the rest." />
          <StepsGrid detailed />
        </Wrap>
      </section>
      <section className="bg-ground">
        <Wrap className="grid items-center gap-8 py-14 lg:grid-cols-2 lg:gap-14 lg:py-20">
          <SectionHead title="Every deal in one stage, with its age." text="In progress, sent, accepted and awaiting signature, completed. Refused is the only exit. Each column shows its count and its annual total, and a deal that has sat too long is flagged for follow-up." />
          <BoardMock />
        </Wrap>
      </section>
      <section className="bg-surface">
        <Wrap className="grid items-center gap-8 py-14 lg:grid-cols-2 lg:gap-14 lg:py-20">
          <div className="flex flex-col gap-8 lg:order-2">
            <SectionHead title="A priced agreement the customer can read." text="Price lines are visits per year times cost per visit. The scope is written from the item types on site, each with its own checklist, and the whole thing is frozen at send, so what they accepted is what is on file." />
          </div>
          <AgreementMock signed={false} className="lg:order-1" />
        </Wrap>
      </section>
      <section className="bg-ground">
        <Wrap className="grid items-center gap-8 py-14 lg:grid-cols-2 lg:gap-14 lg:py-20">
          <SectionHead title="Visits by the month, per service line." text="Heating and cooling in March, June, September and December while the boiler is October only. Pick months on a 12-month grid with quarterly, spring and fall, and monthly presets." />
          <ScheduleMock />
        </Wrap>
      </section>
      <section className="bg-surface">
        <Wrap className="flex flex-col gap-8 py-14 lg:py-20">
          <SectionHead title="Everything in the job." />
          <FeatureGrid />
        </Wrap>
      </section>
      <section className="bg-ground">
        <Wrap className="grid gap-8 py-14 lg:grid-cols-2 lg:gap-14 lg:py-20">
          <SectionHead title="E-signature, with a paper trail." text="The customer signs on your branded page, then you countersign. The contract is complete only when both have signed. The signed PDF and an audit log of who signed, when and from where are stored with it. Your contract wording is yours; you confirm it is valid under your province." />
          <div className="flex flex-col gap-3">
            <h3 className="font-display text-[18px] font-semibold">Not in the product</h3>
            <ul className="flex flex-col divide-y divide-hairline rounded-panel border border-hairline bg-surface">
              {NOT_IN_PRODUCT.map((item) => (
                <li key={item} className="px-4 py-3">
                  {item}
                </li>
              ))}
            </ul>
            <p className="text-ink-2">It is deliberately not a field-service suite. It does one job and feeds a suite later.</p>
          </div>
        </Wrap>
      </section>
      <CtaBand />
    </SiteShell>
  );
}
