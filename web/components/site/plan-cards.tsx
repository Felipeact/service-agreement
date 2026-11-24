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

/** The middle plan is drawn as the highlighted card: dark, blue-ringed and lifted, as in the owner's pricing mockup. */
const FEATURED: PlanKey = "team";

const ICON: Record<PlanKey, string> = { starter: "bolt", team: "electric_bolt", business: "domain" };

/** One plan: name, price, the three limits that differ, and the button into /register. The featured plan is dark. */
function PlanCard({ plan, interval }: CardProps) {
  const isFeatured = plan.key === FEATURED;
  const tone = isFeatured
    ? { card: "bg-[#0f172a] border-2 border-blue-500 shadow-2xl shadow-blue-500/20 text-white md:-translate-y-2", icon: "bg-blue-500/20 text-blue-300 border-blue-400/30", name: "text-white", blurb: "text-slate-300", price: "text-white", unit: "text-blue-200", note: "text-slate-400", rule: "border-slate-800", list: "text-slate-200", strong: "text-white", check: "text-emerald-400", button: "bg-blue-600 hover:bg-blue-500 text-white" }
    : { card: "bg-white border border-slate-200/90 shadow-xs hover:shadow-xl hover:border-blue-300", icon: "bg-blue-50 text-blue-600 border-blue-100", name: "text-slate-900", blurb: "text-slate-500", price: "text-slate-900", unit: "text-slate-500", note: "text-slate-500", rule: "border-slate-100", list: "text-slate-700", strong: "text-slate-900", check: "text-blue-600", button: "bg-slate-900 hover:bg-slate-800 text-white" };
  const features = [
    <><strong className={tone.strong}>{plan.liveAgreements}</strong> live agreements at a time</>,
    <><strong className={tone.strong}>{plan.aiImports}</strong> AI imports a month</>,
    <><strong className={tone.strong}>{plural(plan.includedSeats, "seat", "seats")}</strong> included</>,
    <>Every feature, template and report, the same on every plan</>,
  ];
  return (
    <motion.div className={`relative rounded-3xl p-7 transition-all duration-300 flex flex-col justify-between ${tone.card}`} variants={ITEM} data-plan={plan.key} data-featured={isFeatured || undefined}>
      {isFeatured && (
        <div className="absolute -top-3.5 right-6 bg-blue-600 text-white text-[10px] font-bold uppercase tracking-widest px-3.5 py-1 rounded-full shadow-lg shadow-blue-500/40 flex items-center gap-1">
          <span className="material-symbols-outlined text-[13px]" aria-hidden="true">verified</span> Recommended
        </div>
      )}
      <div className="space-y-5">
        <div>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 border ${tone.icon}`}>
            <span className="material-symbols-outlined text-lg" aria-hidden="true">{ICON[plan.key]}</span>
          </div>
          <h3 className={`text-xl font-extrabold tracking-tight ${tone.name}`}>{plan.name}</h3>
          <p className={`text-xs mt-2 leading-relaxed ${tone.blurb}`}>{BLURB[plan.key]}</p>
        </div>
        <div className={`pb-5 border-b ${tone.rule}`}>
          <div className="flex items-baseline gap-1">
            <span className={`text-4xl font-extrabold font-mono ${tone.price}`}>{priceOf(plan.key, interval)}</span>
            <span className={`text-xs font-mono uppercase tracking-wider font-semibold ml-1 ${tone.unit}`}>CAD / mo</span>
          </div>
          <p className={`text-[11px] mt-1 font-mono ${tone.note}`}>{billedNote(plan.key, interval)}</p>
        </div>
        <ul className={`space-y-3 text-xs ${tone.list}`}>
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2.5">
              <span className={`material-symbols-outlined text-[16px] mt-0.5 ${tone.check}`} aria-hidden="true">check_circle</span>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-8 pt-4">
        <Link className={`w-full min-h-11 py-3 px-4 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 ${tone.button}`} href={registerHref(plan.key, interval)}>
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
