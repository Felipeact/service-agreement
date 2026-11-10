import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import type { OrgSettings } from "@/application/ports";
import { SettingsView } from "./settings-view";

const SELF = path.join(__dirname, "settings-menu.test.ts");
const WEB = path.join(__dirname, "..", "..");

const settings: OrgSettings = {
  legalName: "Kettle Ridge Mechanical Ltd.",
  address: null,
  phone: null,
  accentColor: null,
  repairDiscountPct: 10,
  cpiCapPct: 5,
  cancellationNoticeDays: 30,
  paymentDays: 30,
  governingProvince: "BC",
  taxNote: null,
  defaultTermMonths: 12,
  renewalNoticeDays: 30,
  cpiRenegotiationThresholdPct: 5,
  renewalCpiPct: null,
  renewalCpiAsOf: null,
  proposalValidityDays: 30,
  itemSingular: "equipment",
  itemPlural: "equipment",
};

const html = (billingLink?: boolean) =>
  renderToStaticMarkup(createElement(SettingsView, { settings, role: "owner", action: async (state) => state, billingLink }));

const menu = (out: string) => out.match(/<nav aria-label="Settings sections"[\s\S]*?<\/nav>/)?.[0] ?? "";

function sources(dir = WEB): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return ["node_modules", ".next", ".turbo", "coverage"].includes(entry.name) ? [] : sources(full);
    return /\.(ts|tsx|mts)$/.test(entry.name) && full !== SELF ? [full] : [];
  });
}

describe("the Settings menu", () => {
  test("C3126: with a billing record the menu lists Company, Default terms, Renewal, Members, then Billing, in that order", () => {
    const labels = [...menu(html(true)).matchAll(/>(Company|Default terms|Renewal|Members|Billing)</g)].map((match) => match[1]);
    expect(labels).toEqual(["Company", "Default terms", "Renewal", "Members", "Billing"]);
  });

  test("C3126: Billing is a link to /settings/billing, not an in-page anchor", () => {
    const nav = menu(html(true));
    expect(nav).toMatch(/<a[^>]*href="\/settings\/billing"[^>]*>[\s\S]*?Billing/);
    expect(nav).not.toContain('href="#billing"');
  });

  test("C3126: with no billing record, or none asked for, the menu has no Billing item", () => {
    for (const billingLink of [false, undefined]) expect(menu(html(billingLink))).not.toContain("Billing");
  });

  test("C3127: /settings renders no billing card and no Manage billing button", () => {
    for (const billingLink of [true, false, undefined]) {
      const out = html(billingLink);
      expect(out).not.toContain('id="billing"');
      expect(out).not.toContain("Manage billing");
    }
  });

  test("C3127: no source file mentions the Stripe portal session code", () => {
    const hits = sources().filter((file) => /billing_portal|stripeBillingPortal|openBillingPortalAction/.test(readFileSync(file, "utf8")));
    expect(hits.map((file) => path.relative(WEB, file))).toEqual([]);
  });

  test("C3004: only the section in view is marked: Company at first, and Members and Billing are never marked or blue", () => {
    const nav = menu(html(true));
    expect(nav.match(/aria-current="location"/g)).toHaveLength(1);
    expect(nav).toMatch(/aria-current="location"[^>]*>Company</);
    for (const href of ["/members", "/settings/billing"]) {
      const link = nav.match(new RegExp(`<a[^>]*href="${href.replace(/\//g, "\\/")}"[^>]*>`))?.[0] ?? "";
      expect(link, href).not.toContain("text-action");
      expect(link, href).not.toContain("aria-current");
    }
  });
});
