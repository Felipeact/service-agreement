import type { Metadata } from "next";
import Link from "next/link";
import { FAQS } from "@/components/site/content";
import { FaqList, PageHero, Wrap } from "@/components/site/sections";
import { SiteShell } from "@/components/site/site-shell";
import { LinkButton } from "@/components/ui/link-button";
import { PLANS, formatPlanPrice } from "@/domain/billing";

export const metadata: Metadata = {
  title: "Pricing",
};

/** Shown above the plans; the roadmap's trial terms (decision 8). */
const TRIAL_LINE = "14-day free trial. A card is required to start, and billing is monthly after the trial.";

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
              <article key={plan.key} data-plan={plan.key} className="flex flex-col gap-5 rounded-panel border border-hairline bg-surface p-6 shadow-card">
                <div className="flex flex-col gap-1">
                  <h2 className="font-display text-[20px] font-semibold tracking-tight">{plan.name}</h2>
                  <p className="flex items-baseline gap-1.5">
                    <span className="text-[40px] leading-none font-semibold tracking-tight">{formatPlanPrice(plan.monthlyCents)}</span>
                    <span className="text-ink-2">a month</span>
                  </p>
                </div>
                <ul className="flex flex-col gap-2 border-t border-hairline pt-4 text-[13px]">
                  <li>{plan.liveAgreements} live agreements</li>
                  <li>{plan.aiImports} AI imports a month</li>
                  <li>Unlimited seats</li>
                </ul>
                <LinkButton href={`/register?plan=${plan.key}`} variant="primary" aria-label={`Start 14-day trial, ${plan.name} plan`} className="mt-auto w-full">
                  Start 14-day trial
                </LinkButton>
              </article>
            ))}
          </div>
          <p className="max-w-[70ch] text-[12px] text-ink-2">
            Prices are in Canadian dollars. A live agreement is one in progress, or sent and waiting for the customer. An AI import reads a customer&apos;s list with AI. You choose your trades when you register.
          </p>
        </Wrap>
      </section>
      <section className="bg-surface">
        <Wrap className="grid gap-8 py-12 lg:grid-cols-[1fr_1.4fr] lg:py-16">
          <div className="flex flex-col gap-3">
            <h2 className="font-display text-[28px] leading-[1.1] font-semibold tracking-tight">Every plan has everything.</h2>
            <p className="max-w-[44ch] text-ink-2">Templates, reports and signatures are the same on every plan. Plans differ only in volume, and seats are never charged.</p>
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
