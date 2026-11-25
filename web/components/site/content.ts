import { ANNUAL_DISCOUNT_PERCENT, EXTRA_SEAT_CENTS, PLANS, formatPlanPrice } from "@/domain/billing";
/**
 * Everything the public site says, in one place so every page and every home-page concept reads the same facts.
 * Rule (PRODUCT.md, Evidence on Hand): there are no customers, testimonials or measured results yet, so none appear here.
 * Anything marked "sample" in the UI is synthetic demonstration data, never a claim.
 */

export const SITE = {
  name: "Service Pacts",
  tagline: "From service list to signed agreement.",
  description: "Recurring service agreements for trade contractors, from the customer's list to signature.",
  /** The public mailboxes on servicepacts.com (confirmed by the owner 2026-11-24): general, support for members, sales for buyers. */
  contactEmail: "hello@servicepacts.com",
  supportEmail: "support@servicepacts.com",
  salesEmail: "sales@servicepacts.com",
  /** Privacy requests (access, correction, deletion). The mailbox must exist on servicepacts.com before this ships. */
  privacyEmail: "privacy@servicepacts.com",
} as const;

/** The copyright line: the product name and the current year. No company name is shown until the owner confirms which company operates the service. */
export const COPYRIGHT = `© ${new Date().getFullYear()} Service Pacts. All rights reserved.`;

/**
 * Where the data is kept, stated once so every page says the same thing. Verified 2026-11-23: the Supabase project (the database
 * and the uploaded files) is in region ca-central-1, AWS Canada (Central). The region of the Railway web service is NOT verified,
 * so no page may name one (hosting-claims.test.ts).
 */
export const HOSTING_SHORT = "Database hosted in Canada";
export const HOSTING_DATABASE = "The database and uploaded files are hosted on Supabase in Canada (AWS Canada Central, ca-central-1).";
export const HOSTING_APP = "We have not yet confirmed the region of the web application server, so we make no claim about it.";
export const HOSTING_PROVIDERS = "Some providers we use, such as the AI, e-signature, email and payment providers, handle the data they receive under their own terms and may do so outside Canada.";

export type NavLink = { href: string; label: string };

/** The header's links, in order. Sign in and the trial button sit beside them, never inside this list. */
export const NAV: readonly NavLink[] = [
  { href: "/product", label: "Product" },
  { href: "/demo", label: "Demo" },
  { href: "/trades", label: "Trades" },
  { href: "/pricing", label: "Pricing" },
];

/** The footer's three columns. Every link points at a page that exists (site-pages.test.ts). */
export const FOOTER_GROUPS: readonly { title: string; links: readonly NavLink[] }[] = [
  { title: "Product", links: NAV },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/faq", label: "FAQ" },
      { href: "/contact", label: "Contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms" },
      { href: "/privacy", label: "Privacy" },
      { href: "/security", label: "Security" },
    ],
  },
];

export const FOOTER_LINKS: readonly NavLink[] = FOOTER_GROUPS.flatMap((group) => group.links);

/** The public pages a search engine may list, in sitemap order (qa-p1-p2 C7009). */
export const SITEMAP_PATHS: readonly string[] = ["/", "/product", "/demo", "/trades", "/pricing", "/about", "/faq", "/contact", "/register", "/terms", "/privacy", "/security"];

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
    summary: "An email with a review link; the branded PDF is on that page.",
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
  { q: "Does my customer need an account?", a: "No. They get a link by email, review the agreement, decide, and sign. They sign on a page run by our signature provider." },
  { q: "What file types can I import?", a: "Excel, CSV, Word and PDF. AI reads the rows, maps them to your types and shows a review grid for anything it is unsure of." },
  { q: "Will my customer see your brand?", a: "On the review page, the PDFs and the emails, your company name, logo and accent colour. The signing page is run by our signature provider, DocuSeal, so it and the signed audit log show the name DocuSeal." },
  { q: "Are e-signatures legally valid?", a: "At launch the product targets Canada outside Quebec, where e-signature law follows the UECA model. You own your contract wording and confirm its validity under your province. The starter wording is pending review by a lawyer, so have your own lawyer confirm it before you rely on it." },
  { q: "What about Quebec?", a: "Quebec has its own e-signature framework and language rules. It is a later, separate item." },
  { q: "How does billing work?", a: `Pick a plan and pay by card at checkout. Billing is monthly or annual (annual saves ${ANNUAL_DISCOUNT_PERCENT}%), and you can cancel any time. Stripe handles payment.` },
  { q: "What is a live agreement?", a: "One that is in progress, or sent and waiting for the customer. Plans limit volume only: features, templates and reports are the same on every plan." },
  { q: "Do you charge per seat?", a: `Each plan includes some seats (${PLANS.map((plan) => `${plan.name} ${plan.includedSeats}`).join(", ")}). Every extra seat is ${formatPlanPrice(EXTRA_SEAT_CENTS)} a month.` },
  { q: "What does it not do?", a: "Dispatch, GPS, payroll, construction or project contracts, and a Word-style document editor." },
  { q: "Where is my data hosted?", a: `${HOSTING_DATABASE} ${HOSTING_APP}` },
  { q: "Can I use more than one trade?", a: "Yes. Pick every trade you work in when you register, and your workspace is set up for all of them." },
];

/** The recorded walkthrough video, when there is one. A file under /public or an https URL; null leaves the video out and says nothing about one. */
export const DEMO_VIDEO_URL: string | null = null;
