import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { OrgSettings } from "@/application/ports";
import { SettingsView } from "./settings-view";

// The shell hook reads a provider the page does not mount in a bare render; the words are not under test here.
vi.mock("@/components/shell/item-words", () => ({ useItemWords: () => ({ singular: "equipment", plural: "equipment" }) }));

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
    createElement(SettingsView, {
      settings,
      role: "owner",
      action: async (state) => state,
      billing,
      billingAction: async () => ({ status: "idle" as const }),
    }),
  ).replace(/&#x27;/g, "'");

describe("the Billing section on the Settings page", () => {
  test("C2916: a ready section is mounted with its plan name and button", () => {
    const out = html({ kind: "ready", planName: "Team" });
    expect(out).toContain("Billing");
    expect(out).toContain("Your plan:");
    expect(out).toContain("Team");
    expect(out).toContain("Manage billing");
  });

  test("C2916: an unavailable section is mounted with no button", () => {
    const out = html({ kind: "unavailable", planName: "Team" });
    expect(out).toContain("Billing isn't available yet");
    expect(out).not.toContain("Manage billing");
  });

  test("C2916: a hidden section, and no section at all, leave the page without a Billing heading", () => {
    for (const billing of [{ kind: "hidden" } as const, undefined]) {
      const out = html(billing);
      expect(out).not.toContain('id="billing-title"');
      expect(out).not.toContain("Manage billing");
    }
  });
});
