import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { FOOTER_LINKS } from "@/components/site/content";
import { RegisterFields } from "@/app/register/register-fields";
import { INITIAL_PRICING_STATE } from "@/app/register/state";

vi.mock("@/composition", () => ({ getBillingContainer: vi.fn() }));

const pages: [string, ComponentType][] = [
  ["/terms", (await import("./terms/page")).default],
  ["/privacy", (await import("./privacy/page")).default],
  ["/security", (await import("./security/page")).default],
];

const render = (Page: ComponentType) => renderToStaticMarkup(createElement(Page));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&apos;/g, "'").replace(/\s+/g, " ");

describe("public legal pages", () => {
  test.each(pages)("C6023: %s shows the starter-text notice and never claims a lawyer reviewed it", (_route, Page) => {
    const shown = text(render(Page));
    expect(shown).toContain("Starter text, pending review by a lawyer");
    expect(shown.toLowerCase()).not.toContain("lawyer-reviewed");
    expect(shown.toLowerCase()).not.toContain("reviewed by a lawyer");
  });

  test("C6024: the site footer links the three legal pages", () => {
    const hrefs = FOOTER_LINKS.map((link) => link.href);
    expect(hrefs).toEqual(expect.arrayContaining(["/terms", "/privacy", "/security"]));
  });

  test("C6025: /register links the terms and the privacy policy beside the checkout button", () => {
    const html = renderToStaticMarkup(createElement(RegisterFields, { state: INITIAL_PRICING_STATE, pending: false, action: () => {} }));
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
    expect(html.indexOf("Continue to secure checkout")).toBeLessThan(html.indexOf('href="/terms"'));
  });

  test("C6026: /security names no hosting region while the region is unverified", () => {
    // The page body only: the shared footer says "Built for Canada outside Quebec", which is not a hosting claim.
    const shown = text(render(pages[2][1]).split("<main>")[1].split("</main>")[0]).toLowerCase();
    for (const region of ["canada", "us-east", "us-west", "ca-central", "eu-", "ireland", "frankfurt", "virginia", "oregon", "toronto", "montreal"]) {
      expect(shown, region).not.toContain(region);
    }
    expect(shown).toContain("we have not yet confirmed");
  });

  test("C6026: every factual claim on /security has its source in the repo", () => {
    const root = path.join(__dirname, "..", "..");
    const read = (file: string) => readFileSync(path.join(root, file), "utf8");
    // separated by company: the isolation proofs exist
    expect(existsSync(path.join(root, "supabase/tests/rls_isolation.sql"))).toBe(true);
    // one-time sign-in link: the magic-link confirm route
    expect(existsSync(path.join(root, "web/app/auth/confirm/route.ts"))).toBe(true);
    // DocuSeal signing, with each signer's time and network address kept
    expect(existsSync(path.join(root, "web/app/api/webhooks/docuseal/route.ts"))).toBe(true);
    expect(read("supabase/migrations/20261107175044_signature_webhook.sql")).toContain("signed_ip");
    // card details go to Stripe: no card number field in the app or the register form
    expect(read("web/app/register/register-fields.tsx")).not.toMatch(/card.?number|cardNumber/i);
  });
});
