import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test, vi } from "vitest";

vi.mock("@/composition", () => ({ getBillingContainer: vi.fn() }));
// One plan, named and priced nothing like the real three: whatever the page shows must come from this catalog.
vi.mock("@/domain/billing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/domain/billing")>();
  const { cents } = await import("@/domain/money");
  return { ...actual, PLANS: [{ key: "starter", name: "Zeta", monthlyCents: cents(12300), liveAgreements: 7, aiImports: 9 }] };
});

const { default: PricingPage } = await import("./page");

const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("C2405: the page shows the catalog's one plan and none of the real three", () => {
  const shown = text(renderToStaticMarkup(createElement(PricingPage)));
  for (const expected of ["Zeta", "$123", "7 live agreements", "9 AI imports a month"]) expect(shown).toContain(expected);
  for (const gone of ["$49", "$99", "$199", "Starter", "Team", "Business"]) expect(shown).not.toContain(gone);
});
