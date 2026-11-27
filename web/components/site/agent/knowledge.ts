import { ANNUAL_DISCOUNT_PERCENT, EXTRA_SEAT_CENTS, PLANS, formatPlanPrice } from "@/domain/billing";
import { FAQS, SITE, STEPS, TRADE_PAGES } from "../content";

/**
 * Everything the public chat agent may say, built from the same constants the public pages draw from, so it can never drift from
 * the site: the plans come from `PLANS`, the answers from the FAQ, the steps from the product overview. Nothing about any
 * customer or account is here, because the agent is anonymous and has no access to any.
 */
export function siteKnowledge(): string {
  return [
    `# ${SITE.name}`,
    `${SITE.description} ${SITE.tagline}`,
    "",
    "## How a deal moves",
    ...STEPS.map((step) => `${step.n}. ${step.title} (${step.who}): ${step.summary} ${step.detail}`),
    "",
    `## Plans (prices in Canadian dollars, billed monthly or annual; annual saves ${ANNUAL_DISCOUNT_PERCENT}%)`,
    ...PLANS.map((plan) => `- ${plan.name}: ${formatPlanPrice(plan.monthlyCents)} a month, ${plan.liveAgreements} live agreements, ${plan.aiImports} AI imports a month, ${plan.includedSeats} seats included.`),
    `- Every extra seat is ${formatPlanPrice(EXTRA_SEAT_CENTS)} a month. Features, templates and reports are the same on every plan. A card is charged at checkout; there is no free trial.`,
    "",
    "## Trades",
    ...TRADE_PAGES.map((trade) => `- ${trade.name} (${trade.status}): ${trade.blurb} Examples: ${trade.items.join(", ")}.`),
    "",
    "## Frequently asked questions",
    ...FAQS.map((faq) => `Q: ${faq.q}\nA: ${faq.a}`),
    "",
    "## Contact",
    `General: ${SITE.contactEmail}. Sales: ${SITE.salesEmail}. Support for members: ${SITE.supportEmail}.`,
    "",
    "## Pages the visitor can be sent to",
    "/register (start a workspace), /demo (a walkthrough), /contact, /pricing, /product, /trades, /faq, /security.",
  ].join("\n");
}
