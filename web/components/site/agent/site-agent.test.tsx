import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import { PLANS, formatPlanPrice } from "@/domain/billing";
import { siteKnowledge } from "./knowledge";
import { showsSiteAgent } from "./site-agent";

vi.mock("next/navigation", () => ({ usePathname: () => "/", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/dynamic", () => ({ default: () => () => null }));

describe("where the chat appears", () => {
  test.each(["/", "/pricing", "/contact", "/faq"])("%s carries it", (path) => expect(showsSiteAgent(path)).toBe(true));
  test.each(["/login", "/register", "/pipeline", "/agreements/abc", "/review/token", "/sign/token", "/api/mcp", null])("%s does not", (path) => expect(showsSiteAgent(path)).toBe(false));
});

describe("the site knowledge", () => {
  const text = siteKnowledge();
  test("carries every plan's price from PLANS, so it cannot drift from the pricing page", () => {
    for (const plan of PLANS) expect(text).toContain(`${plan.name}: ${formatPlanPrice(plan.monthlyCents)} a month`);
  });
  test("says nothing about integrations, certifications or customers the site is not allowed to claim", () => {
    expect(text).not.toMatch(/soc ?2|iso ?27001|trusted by|servicetitan|quickbooks|testimonial/i);
  });
  test("names no account or customer data", () => {
    expect(text).not.toMatch(/AG-\d{4}/);
  });
});

describe("the launcher", () => {
  test("renders one labelled round button and no panel until it is pressed", async () => {
    const { SiteAgent } = await import("./site-agent");
    const html = renderToStaticMarkup(createElement(SiteAgent));
    expect(html).toContain('aria-label="Chat with us"');
    expect(html).not.toContain('role="dialog"');
  });
});
