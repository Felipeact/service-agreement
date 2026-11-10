import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { OrgSettings } from "@/application/ports";
import { itemWords } from "@/domain/org-settings";
import { groupSetupCatalog } from "@/domain/org-settings/setup";
import { CatalogReview, SetupView } from "./setup-view";

const settings: OrgSettings = {
  legalName: "Flow Plumbing Ltd.",
  address: null,
  phone: "604-555-0123",
  accentColor: null,
  repairDiscountPct: 0,
  cpiCapPct: 0,
  cancellationNoticeDays: null,
  paymentDays: null,
  governingProvince: null,
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

const words = itemWords("equipment", "equipment");
const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node).replace(/&#x27;/g, "'");
const noop = async () => ({ status: "idle" as const });
const view = (groups = groupSetupCatalog([], words), value = settings) =>
  html(createElement(SetupView, { settings: value, groups, words, action: noop }));

/** The opening tag of the control with this id. */
const tag = (markup: string, id: string) => markup.match(new RegExp(String.raw`<(?:input|select)[^>]*\sid="${id}"[^>]*>`))?.[0] ?? "";

describe("setup screen", () => {
  test("C2808: the form opens with the stored legal name and phone, and blank address, province and accent colour", () => {
    const markup = view();
    expect(tag(markup, "legalName")).toContain('value="Flow Plumbing Ltd."');
    expect(tag(markup, "phone")).toContain('value="604-555-0123"');
    expect(tag(markup, "address")).toContain('value=""');
    expect(tag(markup, "accentColor")).toContain('value=""');
    expect(tag(markup, "itemSingular")).toContain('value="equipment"');
    expect(tag(markup, "itemPlural")).toContain('value="equipment"');
    expect(markup).toMatch(/<option value="" selected[^>]*>Choose one<\/option>|<option value=""[^>]*selected/);
  });

  test("C2808: a stored province is the selected option", () => {
    expect(view(undefined, { ...settings, governingProvince: "BC" })).toMatch(/<option value="BC"[^>]*selected/);
  });

  test("C2808: Continue and Skip for now are two submit buttons with their own intent", () => {
    const markup = view();
    const button = (label: string) => markup.match(new RegExp(String.raw`<button[^>]*>${label}</button>`))?.[0] ?? "";
    for (const [label, intent] of [["Continue", "save"], ["Skip for now", "skip"]]) {
      expect(button(label)).toContain('type="submit"');
      expect(button(label)).toContain('name="intent"');
      expect(button(label)).toContain(`value="${intent}"`);
    }
  });
});

describe("catalog review", () => {
  test("C2817: with no types it says No types yet and that they are added in the task library, with no draft control", () => {
    const markup = html(createElement(CatalogReview, { groups: [], words }));
    expect(markup).toContain("No types yet");
    expect(markup).toContain("task library");
    expect(markup).not.toMatch(/<button|<a |<input|draft|generate/i);
  });

  test("C2817: the empty text speaks the org's plural", () => {
    const markup = html(createElement(CatalogReview, { groups: [], words: itemWords("fixture", "fixtures") }));
    expect(markup).toContain("add the fixtures you service");
  });

  test("C2818: a catalog with types shows names and counts and holds no form control", () => {
    const groups = groupSetupCatalog([{ pack: "plumbing", name: "Sink" }, { pack: "plumbing", name: "Tap" }], words);
    const markup = html(createElement(CatalogReview, { groups, words }));
    expect(markup).toContain("Plumbing");
    expect(markup).toContain("2 equipment types");
    expect(markup).toContain(">Sink<");
    expect(markup).not.toMatch(/<(input|select|textarea|button|form)\b/);
  });
});
