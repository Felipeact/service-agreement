import Link from "next/link";
import * as motion from "motion/react-client";
import { ITEM, STAGGER, VIEWPORT } from "@/components/motion/variants";
import { EXTRA_SEAT_CENTS, PLANS, formatPlanPrice, perMonthCents, type BillingInterval, type Plan, type PlanKey } from "@/domain/billing";
import { billedNote, priceOf, registerHref } from "@/components/site/plan-pricing";

/**
 * The plan cards and comparison table shared by the home page and /pricing. Every figure is read from `PLANS` in
 * `@/domain/billing`, the same catalog Stripe checkout, the plan limits and the in-app Billing page read, so the public
 * site cannot name a plan or quote a limit the product does not have (plan-cards.test.ts keeps it that way).
 */

/** One line about who each plan fits: no claim, only the size of the book it is cut for. */
const BLURB: Record<PlanKey, string> = {
  starter: "For a small team sending its first service agreements.",
  team: "For a team with a steady book of agreements in flight.",
  business: "For a larger team with many agreements in flight at once.",
};

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

type CardProps = { plan: Plan; interval: BillingInterval };

/** One plan: name, price, the three limits that differ, and the button into /register. */
function PlanCard({ plan, interval }: CardProps) {
  return (
    <motion.div
      className="bg-white rounded-3xl p-7 border border-slate-200/90 shadow-xs hover:shadow-xl hover:border-blue-300 transition-all duration-300 flex flex-col justify-between"
      variants={ITEM}
      data-plan={plan.key}
    >
      <div className="space-y-5">
        <div>
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">{plan.name}</h3>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">{BLURB[plan.key]}</p>
        </div>
        <div className="pb-5 border-b border-slate-100">
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-extrabold text-slate-900 font-mono">{priceOf(plan.key, interval)}</span>
            <span className="text-xs text-slate-500 font-mono uppercase tracking-wider font-semibold ml-1">CAD / mo</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1 font-mono">{billedNote(plan.key, interval)}</p>
        </div>
        <ul className="space-y-3 text-xs text-slate-700">
          <li className="flex items-start gap-2.5">
            <span className="material-symbols-outlined text-blue-600 text-[16px] mt-0.5" aria-hidden="true">check_circle</span>
            <span><strong>{plan.liveAgreements}</strong> live agreements at a time</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="material-symbols-outlined text-blue-600 text-[16px] mt-0.5" aria-hidden="true">check_circle</span>
            <span><strong>{plan.aiImports}</strong> AI imports a month</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="material-symbols-outlined text-blue-600 text-[16px] mt-0.5" aria-hidden="true">check_circle</span>
            <span><strong>{plural(plan.includedSeats, "seat", "seats")}</strong> included</span>
          </li>
          <li className="flex items-start gap-2.5">
            <span className="material-symbols-outlined text-blue-600 text-[16px] mt-0.5" aria-hidden="true">check_circle</span>
            <span>Every feature, template and report, the same on every plan</span>
          </li>
        </ul>
      </div>
      <div className="mt-8 pt-4">
        <Link
          className="w-full min-h-11 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
          href={registerHref(plan.key, interval)}
        >
          <span>Get started</span>
          <span className="material-symbols-outlined text-[15px]" aria-hidden="true">arrow_forward</span>
        </Link>
      </div>
    </motion.div>
  );
}

/** The three plan cards, in catalog order, with the extra-seat price under them. */
export function PlanCards({ interval = "month" }: { interval?: BillingInterval }) {
  return (
    <>
      <motion.div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch" initial="hidden" whileInView="show" viewport={VIEWPORT} variants={STAGGER}>
        {PLANS.map((plan) => (
          <PlanCard key={plan.key} plan={plan} interval={interval} />
        ))}
      </motion.div>
      <p className="mt-6 text-center text-xs text-slate-600">
        Extra seats {formatPlanPrice(perMonthCents(EXTRA_SEAT_CENTS, interval))} CAD a month on any plan. Plans limit volume only.
      </p>
    </>
  );
}

const ROWS: readonly { label: string; value: (plan: Plan) => string }[] = [
  { label: "Live agreements at a time", value: (plan) => String(plan.liveAgreements) },
  { label: "AI imports a month", value: (plan) => String(plan.aiImports) },
  { label: "Seats included", value: (plan) => String(plan.includedSeats) },
  { label: "Each extra seat", value: () => `${formatPlanPrice(EXTRA_SEAT_CENTS)} CAD a month` },
  { label: "Features, templates and reports", value: () => "Same on every plan" },
];

/** What differs between the plans, read from the catalog. */
export function PlanComparison() {
  return (
    <div className="overflow-x-auto bg-white rounded-3xl border border-slate-200/90 shadow-xs">
      <table className="w-full text-left border-collapse text-xs">
        <caption className="sr-only">What each plan includes</caption>
        <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
          <tr className="divide-x divide-slate-200">
            <th scope="col" className="p-5 w-2/5 text-sm font-extrabold text-slate-900">Plan</th>
            {PLANS.map((plan) => (
              <th key={plan.key} scope="col" className="p-5 w-1/5 text-center text-sm font-bold text-slate-900">
                {plan.name}
                <br />
                <span className="text-xs font-normal text-slate-500">{formatPlanPrice(plan.monthlyCents)} CAD/mo</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {ROWS.map((row) => (
            <tr key={row.label} className="divide-x divide-slate-100">
              <th scope="row" className="p-4 font-semibold text-slate-800">{row.label}</th>
              {PLANS.map((plan) => (
                <td key={plan.key} className="p-4 text-center">{row.value(plan)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
