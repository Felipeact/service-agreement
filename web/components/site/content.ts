import { EXTRA_SEAT_CENTS, PLANS, formatPlanPrice } from "@/domain/billing";
/**
 * Everything the public site says, in one place so every page and every home-page concept reads the same facts.
 * Rule (PRODUCT.md, Evidence on Hand): there are no customers, testimonials or measured results yet, so none appear here.
 * Anything marked "sample" in the UI is synthetic demonstration data, never a claim.
 */

export const SITE = {
  name: "Service Agreement",
  tagline: "From service list to signed agreement.",
  description: "Recurring service agreements for trade contractors, from the customer's list to signature.",
  /** The public contact mailbox. Confirm it exists before launch. */
  contactEmail: "hello@felipeviana.com",
} as const;

export type NavLink = { href: string; label: string };

/** The header's links, in order. Sign in and the trial button sit beside them, never inside this list. */
export const NAV: readonly NavLink[] = [
  { href: "/product", label: "Product" },
  { href: "/demo", label: "Demo" },
  { href: "/trades", label: "Trades" },
  { href: "/pricing", label: "Pricing" },
  { href: "/about", label: "About" },
  { href: "/faq", label: "FAQ" },
];

export const FOOTER_LINKS: readonly NavLink[] = [...NAV, { href: "/contact", label: "Contact" }];

export type Step = { n: number; title: string; summary: string; detail: string; who: string };

/** How a deal moves (ROADMAP.md, Product overview). */
export const STEPS: readonly Step[] = [
  {
    n: 1,
    title: "Import",
    summary: "Drop in the customer's list.",
    detail: "Upload the Excel, CSV, Word or PDF the customer sent. AI reads the rows, the app maps them to your own item types, and you fix the doubts in a review grid.",
    who: "Estimator",
  },
  {
    n: 2,
    title: "Build",
    summary: "A priced agreement, not a blank page.",
    detail: "Price lines are visits per year times cost per visit. Visit months go on a 12-month grid, and \"Service included\" is written from the item types actually on site.",
    who: "Estimator",
  },
  {
    n: 3,
    title: "Send",
    summary: "A branded PDF and a review link.",
    detail: "The customer gets your logo, your colour and a link by email. Reminders go out on day 3 and day 7 unless they have viewed or decided.",
    who: "Automatic",
  },
  {
    n: 4,
    title: "Decide",
    summary: "Accept, refuse or ask for changes.",
    detail: "No account and no app to learn. They view, download, accept, refuse (with a reason) or request changes, which opens a new version.",
    who: "Customer",
  },
  {
    n: 5,
    title: "Sign",
    summary: "The accepted version becomes a contract.",
    detail: "The customer signs on a page that looks like yours, then you countersign. The contract is complete only when both have signed, and the signed PDF and audit log are kept.",
    who: "Customer, owner",
  },
  {
    n: 6,
    title: "Renew",
    summary: "Nothing quietly lapses.",
    detail: "Near the end of the term, a low-CPI contract renews on its own with the increase applied. A high-CPI one becomes a renewal draft for staff.",
    who: "Automatic, staff",
  },
];

export type Feature = { title: string; text: string };

export const FEATURES: readonly Feature[] = [
  { title: "Messy lists welcome", text: "Excel, CSV, Word or PDF, as the customer sent it. Doubtful rows are flagged for review, never hidden." },
  { title: "Scope that writes itself", text: "\"Service included\" is built from the item types on site, with a checklist for each, editable by you." },
  { title: "Cadence by month", text: "Pick visit months on a 12-month grid per service line, with quarterly, spring and fall, and monthly presets." },
  { title: "A pipeline that never goes quiet", text: "Every deal sits in one stage with its age, so you see what is stuck and what needs a reply." },
  { title: "Their link, your brand", text: "The review page, PDFs, emails and signing page carry your name, logo and colour. Ours never appears." },
  { title: "E-signature with evidence", text: "The customer signs, you countersign, and the signed PDF and audit log are stored with the contract." },
  { title: "Reminders on their own", text: "Emails, nudges and follow-ups run in the background. Your team does not build workflows." },
  { title: "Renewals with CPI", text: "A renewal is a new agreement linked to the old one, with the increase applied inside your cap." },
];

export type TradePage = {
  code: "hvac" | "plumbing" | "electrical" | "other";
  name: string;
  status: string;
  blurb: string;
  items: readonly string[];
  count?: string;
};

export const TRADE_PAGES: readonly TradePage[] = [
  {
    code: "hvac",
    name: "Heating and cooling",
    status: "Starter pack ready",
    blurb: "The first and fullest pack, with a maintenance checklist for each type and default visit months for spring and fall.",
    items: ["Rooftop units", "Air handlers", "Boilers", "Make-up air", "Split systems", "Chillers"],
    count: "About 40 types",
  },
  {
    code: "plumbing",
    name: "Plumbing",
    status: "Starter pack ready",
    blurb: "Backflow, water heaters, pumps and more, reviewed by the owner and open to review by a working plumber.",
    items: ["Backflow preventers", "Water heaters", "Sump pumps", "Grease interceptors"],
    count: "20 types",
  },
  {
    code: "electrical",
    name: "Electrical",
    status: "Starter pack ready",
    blurb: "Panels, emergency lighting and generators, with checklists you can edit.",
    items: ["Panels", "Emergency lighting", "Generators", "Transfer switches"],
    count: "20 types",
  },
  {
    code: "other",
    name: "Another trade",
    status: "Drafted with you",
    blurb: "Describe your trade or upload a proposal you already use. AI drafts the types, checklists and visit months, and you review every line before it is yours.",
    items: ["Janitorial areas", "Landscaping zones", "Pest control stations", "Pools"],
  },
];

export type Faq = { q: string; a: string };

export const FAQS: readonly Faq[] = [
  { q: "Who is it for?", a: "Owners, estimators and office managers at trade contractors that service things on a recurring schedule: heating, cooling and mechanical first, then plumbing, electrical and others." },
  { q: "Is it a field-service suite?", a: "No. It has no dispatch, GPS or payroll. It does one job, from the customer's list to a signed recurring contract, and later will feed a suite." },
  { q: "Does my customer need an account?", a: "No. They get a link by email, review the agreement, decide, and sign. Their email approval counts as written approval." },
  { q: "What file types can I import?", a: "Excel, CSV, Word and PDF. AI reads the rows, maps them to your types and shows a review grid for anything it is unsure of." },
  { q: "Will my customer see your brand?", a: "No. The review page, PDFs, emails and signing page carry your company name, logo and accent colour." },
  { q: "Are e-signatures legally valid?", a: "At launch the product targets Canada outside Quebec, where e-signature law follows the UECA model. You own your contract wording and confirm its validity under your province. Starter wording is reviewed by a lawyer before launch." },
  { q: "What about Quebec?", a: "Quebec has its own e-signature framework and language rules. It is a later, separate item." },
  { q: "How does the free trial work?", a: "14 days free. A card is required to start, and billing is monthly after the trial. Stripe handles payment." },
  { q: "What is a live agreement?", a: "One that is in progress, or sent and waiting for the customer. Plans limit volume only: features, templates and reports are the same on every plan." },
  { q: "Do you charge per seat?", a: `Each plan includes some seats (${PLANS.map((plan) => `${plan.name} ${plan.includedSeats}`).join(", ")}). Every extra seat is ${formatPlanPrice(EXTRA_SEAT_CENTS)} a month.` },
  { q: "What does it not do?", a: "Dispatch, GPS, payroll, construction or project contracts, and a Word-style document editor." },
  { q: "Can I use more than one trade?", a: "Yes. Pick every trade you work in when you register, and your workspace is set up for all of them." },
];

export const NOT_IN_PRODUCT = ["Dispatch and GPS", "Payroll", "Project or construction contracts", "A Word-style document editor"] as const;

/** The recorded walkthrough video, when there is one. A file under /public or an https URL; null shows a "coming soon" panel. */
export const DEMO_VIDEO_URL: string | null = null;
