import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { MemberRole, OrgSettings } from "@/application/ports";
import { PROVINCES } from "@/domain/org-settings";
import { SettingsFields } from "./settings-fields";
import { SettingsView } from "./settings-view";
import { toInput, type SettingsFormState } from "./state";

const settings: OrgSettings = {
  legalName: "Kettle Ridge Mechanical Ltd.",
  address: "100 Sample Street, Burnaby, BC V5A 0A0",
  phone: "604-555-0100",
  accentColor: "#1f6f8b",
  repairDiscountPct: 10,
  cpiCapPct: 5,
  cancellationNoticeDays: 30,
  paymentDays: 30,
  governingProvince: "BC",
  taxNote: "Prices exclude applicable taxes (GST and PST).",
};

const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node).replace(/&#x27;/g, "'");
const noop = async (state: SettingsFormState) => state;
const view = (role: MemberRole, value: OrgSettings | null = settings) =>
  html(createElement(SettingsView, { settings: value, role, action: noop }));
const fields = (state: SettingsFormState, pending = false, readOnly = false, values = toInput(settings)) =>
  html(createElement(SettingsFields, { values, state, pending, readOnly }));

const idle: SettingsFormState = { status: "idle" };

/** The opening tag of the control with this id. */
const hasAttr = (tag: string, name: string) => new RegExp(String.raw`\s${name}(=|\s|/|>)`).test(tag);

const control = (out: string, id: string) => out.match(new RegExp(`<(?:input|select)[^>]*id="${id}"[^>]*>`))?.[0] ?? "";

describe("settings form", () => {
  test("C142: ten labelled controls hold the stored values", () => {
    const out = view("owner");
    const expected: [string, string, string][] = [
      ["legalName", "Legal name", "Kettle Ridge Mechanical Ltd."],
      ["address", "Address", "100 Sample Street, Burnaby, BC V5A 0A0"],
      ["phone", "Phone", "604-555-0100"],
      ["accentColor", "Accent colour", "#1f6f8b"],
      ["repairDiscountPct", "Repair discount (%)", "10"],
      ["cpiCapPct", "CPI cap (%)", "5"],
      ["cancellationNoticeDays", "Cancellation notice (days)", "30"],
      ["paymentDays", "Payment terms (days)", "30"],
      ["taxNote", "Tax note", "Prices exclude applicable taxes (GST and PST)."],
    ];
    for (const [id, label, value] of expected) {
      expect(out, label).toMatch(new RegExp(`<label[^>]*for="${id}"[^>]*>${label.replace(/[()]/g, "\\$&")}</label>`));
      expect(control(out, id), label).toContain(`value="${value}"`);
    }
    expect(out).toMatch(/<label[^>]*for="governingProvince"[^>]*>Governing province</);
    expect(out).toMatch(/<option value="BC" selected/);
  });

  test.each(["owner", "admin"] as const)("C144: a %s can edit and sees Save changes", (role) => {
    const out = view(role);
    expect(hasAttr(control(out, "legalName"), "readOnly")).toBe(false);
    expect(hasAttr(control(out, "governingProvince"), "disabled")).toBe(false);
    expect(out).toMatch(/<button[^>]*type="submit"[^>]*>Save changes</);
    expect(out).not.toContain("Only owners and admins");
  });

  test.each(["estimator", "viewer"] as const)("C145: a %s sees read-only controls and no Save", (role) => {
    const out = view(role);
    for (const id of ["legalName", "address", "phone", "accentColor", "repairDiscountPct", "cpiCapPct", "cancellationNoticeDays", "paymentDays", "taxNote"]) {
      expect(hasAttr(control(out, id), "readOnly"), id).toBe(true);
    }
    expect(hasAttr(control(out, "governingProvince"), "disabled")).toBe(true);
    expect(out).toContain("Only owners and admins can edit company settings.");
    expect(out).not.toContain("Save changes");
  });

  test("C146: without a settings row there is a message and no form", () => {
    const out = view("owner", null);
    expect(out).toContain("Company settings have not been set up for this workspace.");
    expect(out).not.toContain("<form");
  });

  test("C148: invalid fields show their message under them and keep what was typed", () => {
    const values = { ...toInput(settings), legalName: "", cpiCapPct: "abc" };
    const out = fields(
      { status: "invalid", errors: { legalName: "Legal name must be 1 to 120 characters", cpiCapPct: "CPI cap must be a number" }, values },
      false,
      false,
      values,
    );
    expect(control(out, "legalName")).toContain('aria-invalid="true"');
    expect(control(out, "cpiCapPct")).toContain('aria-invalid="true"');
    expect(control(out, "cpiCapPct")).toContain('value="abc"');
    expect(out.match(/aria-invalid/g)).toHaveLength(2);
    expect(out).toMatch(/id="legalName-error"[^>]*>Legal name must be 1 to 120 characters</);
    expect(out).toMatch(/id="cpiCapPct-error"[^>]*>CPI cap must be a number</);
    expect(out.indexOf('id="cpiCapPct-error"')).toBeGreaterThan(out.indexOf('id="cpiCapPct"'));
    expect(out.indexOf('id="cpiCapPct-error"')).toBeLessThan(out.indexOf('for="cancellationNoticeDays"'));
    expect(control(out, "phone")).toContain('value="604-555-0100"');
  });

  test("C149: a saved form says Settings saved", () => {
    expect(fields({ status: "saved", values: toInput(settings) })).toContain("Settings saved");
  });

  test("C150: a refusal shows the permission message and keeps the values", () => {
    const values = { ...toInput(settings), phone: "778-555-0199" };
    const out = fields({ status: "forbidden", values }, false, false, values);
    expect(out).toContain("You don't have permission to change company settings.");
    expect(control(out, "phone")).toContain('value="778-555-0199"');
  });

  test("C151: a failure shows the retry message and keeps the values", () => {
    const values = { ...toInput(settings), phone: "778-555-0199" };
    const out = fields({ status: "unavailable", values }, false, false, values);
    expect(out).toContain("We couldn't save your settings. Try again.");
    expect(control(out, "phone")).toContain('value="778-555-0199"');
  });

  test("C152: while saving the button is disabled and reads Saving…", () => {
    const saving = fields(idle, true).match(/<button[^>]*>Saving…</)?.[0] ?? "";
    expect(hasAttr(saving, "disabled")).toBe(true);
    const idleButton = fields(idle, false).match(/<button[^>]*>Save changes</)?.[0] ?? "";
    expect(idleButton).not.toBe("");
    expect(hasAttr(idleButton, "disabled")).toBe(false);
  });

  test("C154: the province select offers the thirteen codes and an empty option", () => {
    const select = fields(idle).match(/<select[\s\S]*?<\/select>/)?.[0] ?? "";
    const values = [...select.matchAll(/<option value="([^"]*)"/g)].map((match) => match[1]);
    expect(values).toEqual(["", ...PROVINCES]);
  });
});
