import type { Metadata } from "next";
import Link from "next/link";
import { FAQS } from "@/components/site/content";
import { FaqList, PageHero, Wrap } from "@/components/site/sections";
import { SiteShell } from "@/components/site/site-shell";
import { LinkButton } from "@/components/ui/link-button";
import { EXTRA_SEAT_CENTS, PLANS, formatPlanPrice } from "@/domain/billing";

export const metadata: Metadata = {
  title: "Pricing",
};

/** Shown above the plans; the billing terms. */
const TRIAL_LINE = "Simple monthly plans. Billing starts at checkout. Cancel any time.";

const BILLING_QUESTIONS = ["What is a live agreement?", "Do you charge per seat?", "Can I use more than one trade?"];

/**
 * The public price page: the trial terms, then the three plans, each a link to /register with that plan chosen.
 * Trades are picked at registration, not here. Static, so it prerenders.
 */
export default function PricingPage() {
  return (
    <SiteShell>
      <PageHero title="Plans and pricing" text={TRIAL_LINE} />
      <section className="bg-ground">
        <Wrap className="flex flex-col gap-4 pb-12 lg:pb-16">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <article key={plan.key} data-plan={plan.key} className={`flex flex-col gap-5 rounded-panel border bg-surface p-6 shadow-card ${plan.key === "team" ? "border-action ring-1 ring-action" : "border-hairline"}`}>
                <div className="flex flex-col gap-1">
                  <h2 className="flex items-center gap-2 font-display text-[20px] font-semibold tracking-tight">
                    {plan.name}
                    {plan.key === "team" && <span className="rounded-full bg-action-tint px-2 py-0.5 font-sans text-[11px] font-semibold text-action">Suggested start</span>}
                  </h2>
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-[40px] leading-none font-semibold tracking-tight">{formatPlanPrice(plan.monthlyCents)}</span>
                    <span className="text-ink-2">a month</span>
                  </p>
                </div>
                <ul className="flex flex-col gap-2 border-t border-hairline pt-4 text-[15px]">
                  <li>{plan.liveAgreements} live agreements</li>
                  <li>{plan.aiImports} AI imports a month</li>
                  <li>{plan.includedSeats} seats included</li>
                </ul>
                <LinkButton href={`/register?plan=${plan.key}`} variant={plan.key === "team" ? "primary" : "secondary"} aria-label={`Get started, ${plan.name} plan`} className="mt-auto w-full">
                  Get started
                </LinkButton>
              </article>
            ))}
          </div>
          <p className="max-w-[64ch] text-[14px] leading-relaxed text-pretty text-ink-2">
            Team suggests itself for an estimator, an owner and a small office: it includes five seats. Extra seats are {formatPlanPrice(EXTRA_SEAT_CENTS)} a month on every plan. Prices are in Canadian dollars. A live agreement is one in progress, or sent and waiting for the customer. An AI import reads a customer&apos;s list with AI. You choose your trades when you register.
          </p>
        </Wrap>
      </section>
      <section className="bg-surface">
        <Wrap className="grid gap-8 py-12 lg:grid-cols-[1fr_1.4fr] lg:py-16">
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-[28px] leading-[1.1] font-semibold tracking-tight">Every plan has everything.</h2>
            <p className="max-w-[44ch] text-[16px] text-pretty text-ink-2">Templates, reports and signatures are the same on every plan. Plans differ in volume and in the seats they include. Extra seats {formatPlanPrice(EXTRA_SEAT_CENTS)} a month.</p>
            <Link href="/faq" className="inline-flex min-h-11 w-fit items-center font-semibold text-action hover:underline">
              All questions
            </Link>
          </div>
          <FaqList items={FAQS.filter((f) => BILLING_QUESTIONS.includes(f.q))} />
        </Wrap>
      </section>
    </SiteShell>
  );
}
