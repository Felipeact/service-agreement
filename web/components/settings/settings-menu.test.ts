import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { OrgSettings } from "@/application/ports";
import { SettingsView } from "./settings-view";

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

const html = (billing?: Parameters<typeof SettingsView>[0]["billing"]) =>
  renderToStaticMarkup(
    createElement(SettingsView, { settings, role: "owner", action: async (state) => state, billing, billingAction: async () => ({ status: "idle" as const }) }),
  );

const menu = (out: string) => out.match(/<nav aria-label="Settings sections"[\s\S]*?<\/nav>/)?.[0] ?? "";

describe("the Settings menu", () => {
  test("C3003: with a Billing section the menu lists Company, Default terms, Renewal, Members, then Billing, in that order", () => {
    const labels = [...menu(html({ kind: "ready", planName: "Team" })).matchAll(/>(Company|Default terms|Renewal|Members|Billing)</g)].map((match) => match[1]);
    expect(labels).toEqual(["Company", "Default terms", "Renewal", "Members", "Billing"]);
    expect(menu(html({ kind: "ready", planName: "Team" }))).toContain('href="#billing"');
  });

  test("C3003: the Billing card is the target of that link", () => {
    expect(html({ kind: "unavailable", planName: "Team" })).toMatch(/<section id="billing"/);
    expect(menu(html({ kind: "unavailable", planName: "Team" }))).toContain('href="#billing"');
  });

  test("C3003: with no Billing section, or a hidden one, the menu has no Billing item and the page no billing card", () => {
    for (const billing of [undefined, { kind: "hidden" } as const]) {
      const out = html(billing);
      expect(menu(out)).not.toContain("Billing");
      expect(out).not.toContain('id="billing"');
    }
  });

  test("C3004: only the section in view is marked: Company at first, and Members is never marked or blue", () => {
    const nav = menu(html({ kind: "ready", planName: "Team" }));
    expect(nav.match(/aria-current="location"/g)).toHaveLength(1);
    expect(nav).toMatch(/aria-current="location"[^>]*>Company</);
    const members = nav.match(/<a[^>]*href="\/members"[^>]*>/)?.[0] ?? "";
    expect(members).not.toContain("text-action");
    expect(members).not.toContain("aria-current");
  });
});
