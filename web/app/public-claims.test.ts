// @vitest-environment jsdom
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { HOSTING_APP, HOSTING_DATABASE } from "@/components/site/content";
import { HomeA, HomeB, HomeC } from "@/components/site/home-concepts";
import { PLANS } from "@/domain/billing";

vi.mock("@/composition", () => ({ getContainer: vi.fn(), getBillingContainer: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ refresh: () => {} }), useSearchParams: () => new URLSearchParams() }));

/**
 * Claims review, 2026-11-23. Every public page is rendered and its visible text is checked against a list of phrases that
 * were removed because the product cannot back them: no audit report, no customers, no integrations, no features that are
 * not built. A phrase coming back fails the build. To bring one back, the claim has to be true first: add the evidence to
 * CONTEXT.md and take the phrase out of BANNED in the same change.
 */
const BANNED: readonly { phrase: RegExp; why: string }[] = [
  { phrase: /soc ?2/i, why: "no SOC 2 audit report exists" },
  { phrase: /iso ?27001/i, why: "no ISO 27001 certificate exists" },
  { phrase: /trusted by/i, why: "there are no customers yet" },
  { phrase: /\b(250|350)\+/, why: "there are no customers yet" },
  { phrase: /success stories|testimonial|case study/i, why: "there are no customers or testimonials yet" },
  { phrase: /apex (mechanical|climate)|summit hvac|truenorth|prairie (power|peak)|maple leaf climate|quadreal|stewart commercial/i, why: "invented or real company names presented as customers" },
  { phrase: /\$42m|98\.4%|99\.2%|99\.4%|96\.8%|94\.2%|99\.8%|12,000\+|14,200\+|3x faster/i, why: "invented statistics" },
  { phrase: /servicetitan|buildops|quickbooks|xero|\bjonas\b|\berp\b|bidirectional|two-way sync|2-way sync/i, why: "no such integration is built" },
  { phrase: /video (portal|quote|approval|embed)|ready for video|telemetry/i, why: "no such feature is built" },
  { phrase: /regex parser|multi-branch|multi-site batch|portfolio sync|ashrae|csa b52|heat pump (and|&) mechanical rebates/i, why: "no such feature is built" },
  { phrase: /onboarding session|1-hr sla|custom sla|phone support/i, why: "no such support is offered" },
  { phrase: /statcan|statistics canada|bank of canada/i, why: "the CPI figure is typed in by the owner; no data feed is built" },
  { phrase: /legally (enforceable|binding)|enforceable (pdf|agreement)/i, why: "a lawyer has not reviewed the wording" },
  { phrase: /technologies inc/i, why: "that company name is not confirmed to exist" },
  { phrase: /©\s*2025/, why: "stale copyright year" },
  { phrase: /calgary|toronto|montreal/i, why: "hosting regions must match the verified one" },
  { phrase: /reviewed by a lawyer before launch|lawyer-reviewed/i, why: "no lawyer has reviewed the text" },
  { phrase: /most popular|best value/i, why: "no customers to back a popularity claim" },
  { phrase: /256-bit/i, why: "unverified" },
  { phrase: /top up|\$1\.50/i, why: "no import top-up is built" },
];

const text = (html: string) => {
  const body = new DOMParser().parseFromString(html, "text/html").body;
  body.querySelectorAll("script,style").forEach((element) => element.remove());
  return (body.textContent ?? "").replace(/\s+/g, " ");
};
const render = (Page: ComponentType) => text(renderToStaticMarkup(createElement(Page)));

const fromPage = (load: () => Promise<{ default: ComponentType }>) => async () => (await load()).default;
const PAGES: [string, () => Promise<ComponentType>][] = [
  ["/", fromPage(() => import("./page"))],
  ["/product", fromPage(() => import("./product/page"))],
  ["/pricing", fromPage(() => import("./pricing/page"))],
  ["/demo", fromPage(() => import("./demo/page"))],
  ["/trades", fromPage(() => import("./trades/page"))],
  ["/about", fromPage(() => import("./about/page"))],
  ["/faq", fromPage(() => import("./faq/page"))],
  ["/contact", fromPage(() => import("./contact/page"))],
  ["/terms", fromPage(() => import("./terms/page"))],
  ["/privacy", fromPage(() => import("./privacy/page"))],
  ["/security", fromPage(() => import("./security/page"))],
  ["404", fromPage(() => import("./not-found"))],
  ["home concept A", async () => HomeA],
  ["home concept B", async () => HomeB],
  ["home concept C", async () => HomeC],
  [
    "/login",
    async () => {
      const { Content } = await import("./login/_components/content");
      const { LoginFields } = await import("./login/login-fields");
      return () => createElement(Content, { form: createElement(LoginFields, { state: { status: "idle" }, pending: false, linkInvalid: false }) });
    },
  ],
  [
    "/register",
    async () => {
      const { Content } = await import("./register/_components/content");
      const { RegisterFields } = await import("./register/register-fields");
      return () => createElement(Content, { form: createElement(RegisterFields, { state: { status: "idle" }, pending: false }) });
    },
  ],
];

const rendered = new Map<string, string>();
async function shown(route: string) {
  if (!rendered.has(route)) {
    const load = PAGES.find(([name]) => name === route)![1];
    rendered.set(route, render(await load()));
  }
  return rendered.get(route)!;
}

describe("the public pages make none of the claims that were removed", () => {
  test.each(PAGES.map(([route]) => route))("%s", async (route) => {
    const page = await shown(route);
    expect(page.length).toBeGreaterThan(200);
    const found = BANNED.filter(({ phrase }) => phrase.test(page)).map(({ phrase, why }) => `${phrase} (${why})`);
    expect(found).toEqual([]);
  });

  test("the pricing page's annual view makes none either", async () => {
    const { Content } = await import("./pricing/_components/content");
    const page = text(renderToStaticMarkup(createElement(Content, { interval: "year" })));
    expect(BANNED.filter(({ phrase }) => phrase.test(page))).toEqual([]);
  });

  test("the banned list catches what it was written to catch", () => {
    for (const sample of ["SOC2 Type II Compliant", "ISO 27001", "Trusted by 250+ contractors", "ServiceTitan 2-way sync", "Client video portal", "© 2025 Service Pacts Technologies Inc.", "Calgary & Toronto"]) {
      expect(BANNED.some(({ phrase }) => phrase.test(sample)), sample).toBe(true);
    }
  });
});

describe("the source of the public pages carries none of them either", () => {
  const WEB = path.join(__dirname, "..");
  const sourceFiles = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === ".next" || entry.name === "(app)" || entry.name === "concepts" ? [] : sourceFiles(full);
      return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
    });

  test("no source file under app/ (outside the signed-in app) or components/site names an audit, a customer or an integration", () => {
    const files = [...sourceFiles(path.join(WEB, "app")), ...sourceFiles(path.join(WEB, "components", "site"))];
    expect(files.length).toBeGreaterThan(20);
    const source = [/soc ?2/i, /iso ?27001/i, /trusted by/i, /technologies inc/i, /servicetitan/i, /©\s*2025/];
    const hits = files.flatMap((file) => {
      const code = readFileSync(file, "utf8");
      return source.filter((phrase) => phrase.test(code)).map((phrase) => `${path.relative(WEB, file)}: ${phrase}`);
    });
    expect(hits).toEqual([]);
  });
});

describe("sample names are labelled as samples", () => {
  test.each(PAGES.map(([route]) => route))("%s: a page that shows the sample company Blue Heron also says it is sample data", async (route) => {
    const page = await shown(route);
    if (/blue heron/i.test(page)) expect(page).toMatch(/sample/i);
  });
});

describe("one story about where the data lives", () => {
  test("/security, /faq and /pricing each state the verified database region and say the app server region is unconfirmed", async () => {
    for (const route of ["/security", "/faq", "/pricing"]) {
      const page = await shown(route);
      expect(page, route).toContain(HOSTING_DATABASE);
      expect(page, route).toContain(HOSTING_APP);
    }
  });

  test("no public page names a hosting region other than ca-central-1", async () => {
    for (const [route] of PAGES) {
      const page = await shown(route);
      const regions = page.match(/\b(us|eu|ap|ca|sa|me|af)-(east|west|central|north|south|northeast|southeast)-\d\b/g) ?? [];
      expect(regions.filter((region) => region !== "ca-central-1"), route).toEqual([]);
    }
  });
});

describe("the plans on the public pages are the billing catalog", () => {
  test.each(["/pricing", "/"])("%s names every plan and quotes its limits and seats", async (route) => {
    const page = await shown(route);
    for (const plan of PLANS) {
      expect(page, `${route} ${plan.key}`).toContain(plan.name);
      expect(page, `${route} ${plan.key} price`).toContain(`$${plan.monthlyCents / 100}`);
      expect(page, `${route} ${plan.key} live agreements`).toMatch(new RegExp(`${plan.liveAgreements}\\s*live agreements at a time`));
      expect(page, `${route} ${plan.key} AI imports`).toMatch(new RegExp(`${plan.aiImports}\\s*AI imports a month`));
      expect(page, `${route} ${plan.key} seats`).toMatch(new RegExp(`${plan.includedSeats} seats\\s*included`));
    }
    // The retired mockup names must not come back beside the catalog's.
    expect(page).not.toMatch(/\bMax\b|\bPro\b|Enterprise/);
  });

  test("the pricing page's comparison table lists the same figures as the cards", async () => {
    const page = await shown("/pricing");
    for (const plan of PLANS) {
      expect(page).toMatch(new RegExp(`${plan.name}\\s*\\$${plan.monthlyCents / 100} CAD/mo`));
    }
  });
});
