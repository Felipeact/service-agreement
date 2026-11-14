import Link from "next/link";
import type { CSSProperties } from "react";
import { Reveal } from "@/components/motion/reveal";
import { LinkButton } from "@/components/ui/link-button";
import { SITE } from "./content";
import { AgreementMock, BoardMock, PortalMock, ScheduleMock, ScopeMock, YearBand } from "./mock-ui";
import { CtaBand, PlansTeaser, SectionHead, StepsGrid, TradeCards, Wrap } from "./sections";
import { SiteShell } from "./site-shell";

/**
 * Three concepts for the public home page, one shared set of facts (content.ts) and one design system (DESIGN.md).
 * They differ in what the first screen proves: A shows the pipeline, B the agreement the customer receives,
 * C the year of visits. The owner picks one; the other two are deleted.
 */

/** Where a block sits in the first screen's entrance; `hero-in` reads it as a delay. */
const step = (i: number) => ({ "--i": i }) as CSSProperties;

function Actions({ onDark = false }: { onDark?: boolean }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <LinkButton href="/register" variant="primary" className={`h-12 px-5 text-[14px] lg:h-11 ${onDark ? "bg-surface text-ink hover:bg-surface/90" : ""}`}>
        Get started
      </LinkButton>
      <LinkButton
        href="/demo"
        variant="secondary"
        className={`h-12 px-5 text-[14px] lg:h-11 ${onDark ? "border-surface/40 bg-transparent text-surface hover:bg-surface/10" : ""}`}
      >
        Step through the demo
      </LinkButton>
    </div>
  );
}

const trialNote = "Monthly plans from $79. Built for Canadian trade contractors.";

function Portal({ flip = false }: { flip?: boolean }) {
  return (
    <section className="bg-ground">
      <Wrap className="grid items-center gap-8 py-14 lg:grid-cols-2 lg:gap-14 lg:py-20">
        <div className={flip ? "lg:order-2" : ""}>
          <SectionHead
            title="Your customer sees your name, not ours."
            text="They get a link. No account, no app to learn. The page, the PDFs, the emails and the signing screen carry your logo and your colour, and their reply is a single tap."
          />
          <Link href="/product" className="mt-5 inline-flex min-h-11 items-center text-[15px] font-semibold text-action hover:underline">
            See how a deal moves
          </Link>
        </div>
        <Reveal className={flip ? "lg:order-1" : ""}>
          <PortalMock />
        </Reveal>
      </Wrap>
    </section>
  );
}

function Tail({ showPortal = true, flip = false }: { showPortal?: boolean; flip?: boolean }) {
  return (
    <>
      <section className="bg-surface">
        <Wrap className="flex flex-col gap-8 py-14 lg:py-20">
          <SectionHead title="Six steps, one job." text="From the list the customer sent to a contract that renews itself. Nothing slips between a spreadsheet and an inbox." />
          <StepsGrid />
        </Wrap>
      </section>
      {showPortal && <Portal flip={flip} />}
      <section className="bg-night text-surface ring-on-dark">
        <Wrap className="flex flex-col gap-10 py-14 lg:gap-12 lg:py-24">
          <div className="grid items-start gap-8 lg:grid-cols-[1.3fr_0.7fr] lg:gap-14">
            <SectionHead
              onDark
              title="One agreement for the whole service year."
              text="Each service line holds its own visit months, so heating and cooling can run in March, June, September and December while the boiler is October only. The customer signs once, and the scope is written from the types on their list."
            />
            <ScopeMock className="text-night-ink" />
          </div>
          <YearBand className="text-night-ink" />
        </Wrap>
      </section>
      <section className="bg-ground">
        <Wrap className="flex flex-col gap-8 py-14 lg:py-20">
          <SectionHead title="Your trade, set up on day one." text="Pick the trades you work in when you register. Your workspace starts with their service types, checklists and visit months, and everything stays editable." />
          <TradeCards />
          <Link href="/trades" className="inline-flex min-h-11 w-fit items-center text-[15px] font-semibold text-action hover:underline">
            All trades
          </Link>
        </Wrap>
      </section>
      <section className="bg-surface">
        <Wrap className="flex flex-col gap-8 py-14 lg:py-20">
          <SectionHead title="Priced by volume, with seats included." text="Every plan has every feature and a few seats. You pay for how many agreements are live and how many lists AI reads, and a small fee for each extra seat." />
          <PlansTeaser />
          <Link href="/pricing" className="inline-flex min-h-11 w-fit items-center text-[15px] font-semibold text-action hover:underline">
            Compare plans
          </Link>
        </Wrap>
      </section>
      <CtaBand />
    </>
  );
}

/** Concept A, "The Board": the pipeline is the proof. A light ground, the headline, then the whole board beneath it. */
export function HomeA() {
  return (
    <SiteShell tone="light">
      <section className="bg-ground">
        <Wrap className="flex flex-col gap-8 pt-8 pb-12 lg:gap-12 lg:pt-16 lg:pb-20">
          <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
          <div className="flex flex-col gap-5">
            <h1 style={step(0)} className="hero-in max-w-[16ch] font-display text-[42px] leading-[1.02] font-semibold tracking-tight text-balance lg:text-[68px]">{SITE.tagline}</h1>
            <p style={step(1)} className="hero-in max-w-[56ch] text-[16px] leading-relaxed text-ink-2 lg:text-[18px]">
              Import the customer&apos;s list, send a priced agreement under your own brand, and follow it to a signed contract. Every deal sits in one stage with its age, so nothing goes quiet.
            </p>
            <div style={step(2)} className="hero-in">
              <Actions />
            </div>
            <p style={step(3)} className="hero-in text-[14px] text-ink-2">{trialNote}</p>
          </div>
          <div style={step(3)} className="hero-in">
            <PortalMock />
          </div>
          </div>
          <div style={step(4)} className="hero-in rounded-panel border border-hairline bg-surface p-3 shadow-panel md:p-4">
            <BoardMock />
          </div>
        </Wrap>
      </section>
      <Tail />
    </SiteShell>
  );
}

/** Concept B, "The Paper": the agreement is the proof. Night ground, the headline, and the sheet the customer signs. */
export function HomeB() {
  return (
    <SiteShell tone="night">
      <section className="bg-night text-surface ring-on-dark">
        <Wrap className="grid items-center gap-10 pt-8 pb-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pt-16 lg:pb-24">
          <div className="flex flex-col gap-5">
            <h1 style={step(0)} className="hero-in max-w-[12ch] font-display text-[44px] leading-[1] font-semibold tracking-tight text-balance lg:text-[76px]">{SITE.tagline}</h1>
            <p style={step(1)} className="hero-in max-w-[48ch] text-[16px] leading-relaxed text-night-ink lg:text-[18px]">
              A priced, branded service agreement built from the customer&apos;s own list. They accept it from an email link and sign it on a page that looks like yours.
            </p>
            <div style={step(2)} className="hero-in">
              <Actions onDark />
            </div>
            <p style={step(3)} className="hero-in text-[14px] text-night-ink">{trialNote}</p>
          </div>
          <div style={step(4)} className="hero-in">
            <AgreementMock className="text-night-ink lg:translate-y-4" />
          </div>
        </Wrap>
      </section>
      <Tail flip />
    </SiteShell>
  );
}

/** Concept C, "The Year": cadence is the proof. A drenched action-blue ground and the twelve-month visit grid. */
export function HomeC() {
  return (
    <SiteShell tone="action">
      <section className="bg-action text-surface ring-on-dark">
        <Wrap className="flex flex-col gap-10 pt-8 pb-14 lg:gap-14 lg:pt-16 lg:pb-24">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <h1 style={step(0)} className="hero-in font-display text-[44px] leading-[1] font-semibold tracking-tight text-balance lg:text-[76px]">Twelve months, one agreement.</h1>
            <div style={step(1)} className="hero-in flex flex-col gap-5">
              <p className="text-[16px] leading-relaxed text-surface/90 lg:text-[17px]">
                Quote recurring service by the month. Each line holds its own visits, the customer signs once, and renewals come back on their own.
              </p>
              <Actions onDark />
              <p className="text-[14px] text-surface/85">{trialNote}</p>
            </div>
          </div>
          <div style={step(3)} className="hero-in">
            <ScheduleMock className="text-surface" />
          </div>
        </Wrap>
      </section>
      <Tail showPortal />
    </SiteShell>
  );
}
