import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Reveal } from "@/components/motion/reveal";
import { ShaderCanvas } from "@/components/motion/shader-canvas";
import { RooftopScene } from "@/components/ui/illustrations";
import { LinkButton } from "@/components/ui/link-button";
import { EXTRA_SEAT_CENTS, PLANS, formatPlanPrice } from "@/domain/billing";
import { FAQS, FEATURES, STEPS, TRADE_PAGES, type Faq } from "./content";

/** The one content width of the public site. */
export function Wrap({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1180px] px-4 md:px-6 lg:px-8 ${className}`}>{children}</div>;
}

export function SectionHead({ title, text, onDark = false, className = "" }: { title: string; text?: string; onDark?: boolean; className?: string }) {
  return (
    <Reveal className={`flex max-w-[60ch] flex-col gap-3 ${className}`}>
      <h2 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.02em] text-balance lg:text-[36px]">{title}</h2>
      {text && <p className={`text-[16px] leading-relaxed text-pretty lg:text-[17px] ${onDark ? "text-night-ink" : "text-ink-2"}`}>{text}</p>}
    </Reveal>
  );
}

/**
 * The header of every inner page: a title, one plain line, and an optional action row, over the light shader backdrop.
 * `accent` is the end of the title (the part that names the promise) set in the action colour; the title's text is unchanged.
 */
export function PageHero({ title, text, accent, children }: { title: string; text: string; accent?: string; children?: ReactNode }) {
  const accented = accent && title.endsWith(accent) ? { head: title.slice(0, title.length - accent.length), accent } : null;
  return (
    <section className="relative overflow-hidden border-b border-hairline bg-ground">
      <ShaderCanvas variant="light" />
      <Wrap className="relative flex flex-col gap-5 pt-10 pb-10 lg:pt-16 lg:pb-14">
        <h1 style={{ "--i": 0 } as CSSProperties} className="hero-in max-w-[20ch] text-[36px] leading-[1.08] font-bold tracking-[-0.025em] text-balance lg:text-[56px] lg:leading-[1.05]">
          {accented ? (
            <>
              {accented.head}
              <span className="text-action">{accented.accent}</span>
            </>
          ) : (
            title
          )}
        </h1>
        <p style={{ "--i": 1 } as CSSProperties} className="hero-in max-w-[62ch] text-[16px] leading-relaxed text-pretty text-ink-2 lg:text-[18px]">{text}</p>
        {children && (
          <div style={{ "--i": 2 } as CSSProperties} className="hero-in">
            {children}
          </div>
        )}
      </Wrap>
    </section>
  );
}

/** The six steps as a numbered row of cards: the deal's whole path on one screen. */
/** Each step wears the tint of the board stage it belongs to, so the path reads like the pipeline it feeds. */
const STEP_TINT = ["bg-tint-in-progress", "bg-tint-in-progress", "bg-tint-sent", "bg-tint-sent", "bg-tint-accepted", "bg-board"] as const;

export function StepsGrid({ detailed = false, onDark = false }: { detailed?: boolean; onDark?: boolean }) {
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {STEPS.map((step, i) => (
        <Reveal
          as="li"
          key={step.n}
          index={i % 3}
          className={`flex flex-col gap-2 rounded-panel border p-5 shadow-card ${onDark ? "border-night-line bg-night-raised/90 text-surface" : "border-hairline bg-surface"}`}
        >
          <div className="flex items-center justify-between">
            <span className={`flex size-8 items-center justify-center rounded-full text-[14px] font-semibold ${onDark ? "bg-action text-surface" : `text-ink ${STEP_TINT[step.n - 1] ?? "bg-board"}`}`}>{step.n}</span>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${onDark ? "bg-night-line text-night-ink" : "bg-board text-ink-2"}`}>{step.who}</span>
          </div>
          <h3 className="text-[18px] font-semibold tracking-tight">{step.title}</h3>
          <p className="text-[15px] font-medium text-pretty">{step.summary}</p>
          {detailed && <p className={`text-[15px] leading-relaxed text-pretty ${onDark ? "text-night-ink" : "text-ink-2"}`}>{step.detail}</p>}
        </Reveal>
      ))}
    </ol>
  );
}

export function FeatureGrid() {
  return (
    <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
      {FEATURES.map((feature, i) => (
        <Reveal as="li" key={feature.title} index={i % 4} className="flex flex-col gap-1.5 border-t border-hairline pt-4">
          <h3 className="font-display text-[16px] font-semibold tracking-tight">{feature.title}</h3>
          <p className="text-[15px] text-pretty text-ink-2">{feature.text}</p>
        </Reveal>
      ))}
    </ul>
  );
}

export function TradeCards() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {TRADE_PAGES.map((trade, i) => (
        <Reveal as="li" key={trade.code} index={i % 4}>
          <Link href="/trades" className="flex h-full min-h-11 flex-col gap-2 rounded-panel border border-hairline bg-surface p-5 shadow-card transition-shadow duration-200 hover:shadow-lift">
            <span className="w-fit rounded-full bg-board px-2 py-0.5 text-[11px] font-semibold text-ink-2">{trade.status}</span>
            <h3 className="font-display text-[18px] font-semibold tracking-tight">{trade.name}</h3>
            <p className="text-[15px] text-pretty text-ink-2">{trade.items.slice(0, 3).join(", ")}…</p>
          </Link>
        </Reveal>
      ))}
    </ul>
  );
}

/** The three plans in short, from the one catalog the pricing page and the limits read. */
export function PlansTeaser() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 md:grid-cols-3">
        {PLANS.map((plan, i) => (
          <Reveal key={plan.key} index={i} className="flex flex-col gap-1 rounded-panel border border-hairline bg-surface p-5 shadow-card">
            <p className="font-display text-[16px] font-semibold">{plan.name}</p>
            <p className="flex items-baseline gap-1.5">
              <span className="text-[30px] leading-none font-semibold tracking-tight">{formatPlanPrice(plan.monthlyCents)}</span>
              <span className="text-ink-2">a month</span>
            </p>
            <ul className="mt-3 flex flex-col gap-1.5 border-t border-hairline pt-3 text-[15px]">
              <li>{plan.liveAgreements} live agreements</li>
              <li>{plan.aiImports} AI imports a month</li>
              <li>{plan.includedSeats} seats included</li>
            </ul>
          </Reveal>
        ))}
      </div>
      <p className="text-[14px] text-ink-2">Extra seats {formatPlanPrice(EXTRA_SEAT_CENTS)} a month.</p>
    </div>
  );
}

export function FaqList({ items = FAQS }: { items?: readonly Faq[] }) {
  return (
    <div className="flex flex-col divide-y divide-hairline rounded-panel border border-hairline bg-surface shadow-card">
      {items.map((item) => (
        <details key={item.q} className="group px-5">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-3 font-display text-[16px] font-semibold marker:hidden [&::-webkit-details-marker]:hidden">
            {item.q}
            <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 shrink-0 fill-none stroke-ink-2 transition-transform duration-200 group-open:rotate-180" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 8 5 5 5-5" />
            </svg>
          </summary>
          <p className="max-w-[68ch] pb-4 text-[15px] leading-relaxed text-pretty text-ink-2">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

/** The closing band of a page: one sentence and the two doors, trial and demo. */
export function CtaBand({ title = "See it with your own list.", text = `Monthly plans from ${formatPlanPrice(PLANS.reduce((lowest, plan) => (plan.monthlyCents < lowest ? plan.monthlyCents : lowest), PLANS[0].monthlyCents))}, and your workspace is set up for your trade.`, demo = true }: { title?: string; text?: string; demo?: boolean }) {
  return (
    <section className="relative overflow-hidden bg-night text-surface ring-on-dark">
      <ShaderCanvas variant="night" className="opacity-50" />
      <Wrap className="relative grid items-center gap-8 py-14 lg:grid-cols-[1fr_340px] lg:gap-14 lg:py-20">
        <div className="flex flex-col gap-6">
          <div className="flex max-w-[52ch] flex-col gap-3">
            <h2 className="font-display text-[30px] leading-[1.08] font-semibold tracking-tight text-balance lg:text-[42px]">{title}</h2>
            <p className="text-[16px] text-pretty text-night-ink">{text}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <LinkButton href="/register" variant="primary">
              Get started
            </LinkButton>
            {demo && (
              <LinkButton href="/demo" variant="secondary" className="border-surface/40 bg-transparent text-surface hover:bg-surface/10">
                Step through the demo
              </LinkButton>
            )}
          </div>
        </div>
        <RooftopScene className="hidden w-full text-night-ink lg:block" />
      </Wrap>
    </section>
  );
}
