import type { Metadata } from "next";
import { Suspense } from "react";
import { Wrap } from "@/components/site/sections";
import { SiteShell } from "@/components/site/site-shell";
import { PLAN_KEYS, type PlanKey } from "@/domain/billing";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Register" };

/** Reads `?plan=` at request time (the pricing page's plan buttons carry it); the plain form is the prerendered fallback. */
export async function RegisterFormForRequest({ searchParams }: Pick<PageProps<"/register">, "searchParams">) {
  const { plan } = await searchParams;
  const initialPlan = PLAN_KEYS.find((key) => key === plan) as PlanKey | undefined;
  return <RegisterForm initialPlan={initialPlan} />;
}

/**
 * Where a new business says what it does, before it pays (decision 6, onboarding step 1): its trades and a plan,
 * then Checkout. The trades live here, not on the pricing page, so the price page stays about prices.
 */
export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  return (
    <SiteShell>
      <section className="bg-ground">
        <Wrap className="grid gap-8 py-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14 lg:py-16">
          <div className="flex flex-col gap-4">
            <h1 className="max-w-[14ch] font-display text-[36px] leading-[1.05] font-semibold tracking-tight text-balance lg:text-[52px]">Start your free trial.</h1>
            <p className="max-w-[44ch] text-[15px] leading-relaxed text-ink-2">
              Tell us your trade and we set up your workspace to match: service types, checklists and visit months, all editable.
            </p>
            <ol className="flex flex-col gap-2 text-ink-2">
              <li>1. Your trades and plan, here.</li>
              <li>2. Email and card, with our payment provider.</li>
              <li>3. A sign-in link, then a short setup for your company.</li>
            </ol>
          </div>
          <div className="rounded-panel border border-hairline bg-surface p-5 shadow-panel sm:p-7">
            <Suspense fallback={<RegisterForm />}>
              <RegisterFormForRequest searchParams={searchParams} />
            </Suspense>
          </div>
        </Wrap>
      </section>
    </SiteShell>
  );
}
