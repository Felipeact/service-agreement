import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { OrgSettings } from "@/application/ports";
import { itemWords } from "@/domain/org-settings";
import { SetupView } from "@/components/setup/setup-view";
import { LogoFieldView } from "./logo-field";
import { SettingsFields } from "./settings-fields";
import { toInput } from "./state";

vi.mock("next/link", () => ({ default: ({ children, href }: { children: unknown; href: string }) => createElement("a", { href }, children as never) }));

const ORG = "11111111-1111-4111-8111-111111111111";
const PATH = `${ORG}/33333333-3333-4333-8333-333333333333.png`;
const BASE = "https://x.supabase.co";

const settings: OrgSettings = {
  legalName: "Flow Plumbing Ltd.", address: null, phone: null, accentColor: null, repairDiscountPct: 0, cpiCapPct: 0, cancellationNoticeDays: null,
  paymentDays: null, governingProvince: "BC", taxNote: null, defaultTermMonths: 12, renewalNoticeDays: 30, cpiRenegotiationThresholdPct: 5,
  renewalCpiPct: null, renewalCpiAsOf: null, proposalValidityDays: 30, itemSingular: "equipment", itemPlural: "equipment",
};
const html = (node: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(node).replace(/&#x27;/g, "'");

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", BASE);
});

const view = (over: Partial<Parameters<typeof LogoFieldView>[0]> = {}) =>
  html(createElement(LogoFieldView, { path: "", src: null, status: "idle", readOnly: false, ...over }));

describe("the logo field", () => {
  test("C3321: with a picked file it shows the preview and 'Logo ready', and the hidden logoPath holds the new path", () => {
    const markup = view({ path: PATH, src: "blob:http://localhost/abc", status: "ready" });
    expect(markup).toMatch(/<img[^>]*src="blob:http:\/\/localhost\/abc"/);
    expect(markup).toContain("Logo ready");
    expect(markup).toMatch(new RegExp(`<input[^>]*type="hidden"[^>]*name="logoPath"[^>]*value="${PATH}"`));
  });

  test("C3321: with no pick it holds the stored path (or an empty value) and does not say 'Logo ready'", () => {
    const stored = view({ path: PATH, src: `${BASE}/storage/v1/object/public/logos/${PATH}`, status: "idle" });
    expect(stored).toMatch(new RegExp(`name="logoPath"[^>]*value="${PATH}"`));
    expect(stored).not.toContain("Logo ready");
    expect(view()).toMatch(/name="logoPath"[^>]*value=""/);
  });

  test("C3324: with no logo it says 'No logo yet' and 'PNG or JPEG, up to 1 MB', and offers Choose logo but not Remove logo", () => {
    const markup = view();
    expect(markup).toContain("No logo yet");
    expect(markup).toContain("PNG or JPEG, up to 1 MB");
    expect(markup).toContain("Choose logo");
    expect(markup).not.toContain("Remove logo");
    expect(markup).not.toContain("<img");
  });

  test("with a stored logo it offers Replace logo and Remove logo", () => {
    const markup = view({ path: PATH, src: `${BASE}/storage/v1/object/public/logos/${PATH}` });
    expect(markup).toContain("Replace logo");
    expect(markup).toContain("Remove logo");
  });

  test("C3323: read-only shows the stored logo with no choose or remove control and no file input", () => {
    const markup = view({ path: PATH, src: `${BASE}/storage/v1/object/public/logos/${PATH}`, readOnly: true });
    expect(markup).toMatch(/<img[^>]*src="https:\/\/x\.supabase\.co\/storage\/v1\/object\/public\/logos\//);
    for (const absent of ["Choose logo", "Replace logo", "Remove logo", 'type="file"', 'name="logoPath"']) expect(markup).not.toContain(absent);
  });

  test("C3323: an estimator's settings page renders the stored logo read-only through the real form", () => {
    const markup = html(
      createElement(SettingsFields, { values: { ...toInput(settings), logoPath: PATH }, state: { status: "idle" }, pending: false, readOnly: true }),
    );
    expect(markup).toContain(`${BASE}/storage/v1/object/public/logos/${PATH}`);
    for (const absent of ["Choose logo", "Replace logo", "Remove logo", 'type="file"']) expect(markup).not.toContain(absent);
  });

  test("an error from a failed upload shows under the field as an alert", () => {
    const markup = view({ status: "error", error: "Logo upload failed, try again" });
    expect(markup).toMatch(/role="alert"[^>]*>Logo upload failed, try again</);
  });
});

describe("saving while a logo uploads", () => {
  const noop = async () => ({ status: "idle" as const });

  test("C3322: on /settings the Save button is disabled and says 'Uploading logo' while an upload is under way, and 'Save changes' when none is", () => {
    const uploading = html(createElement(SettingsFields, { values: toInput(settings), state: { status: "idle" }, pending: false, readOnly: false, initialUploading: true }));
    expect(uploading).toMatch(/<button[^>]*type="submit"[^>]*disabled=""[^>]*>Uploading logo<\/button>/);
    const idle = html(createElement(SettingsFields, { values: toInput(settings), state: { status: "idle" }, pending: false, readOnly: false }));
    expect(idle).toMatch(/<button[^>]*type="submit"[^>]*>Save changes<\/button>/);
    expect(idle).not.toMatch(/<button[^>]*disabled=""[^>]*>Save changes/);
  });

  test("C3322: on /setup Continue is disabled and says 'Uploading logo' (and Skip is disabled too) while an upload is under way", () => {
    const words = itemWords("equipment", "equipment");
    const uploading = html(createElement(SetupView, { settings, groups: [], words, action: noop, initialUploading: true }));
    expect(uploading).toMatch(/<button[^>]*value="save"[^>]*disabled=""[^>]*>Uploading logo<\/button>/);
    expect(uploading).toMatch(/<button[^>]*value="skip"[^>]*disabled=""[^>]*>Skip for now<\/button>/);
    const idle = html(createElement(SetupView, { settings, groups: [], words, action: noop }));
    expect(idle).toMatch(/<button[^>]*value="save"[^>]*>Continue<\/button>/);
    expect(idle).not.toMatch(/<button[^>]*value="save"[^>]*disabled/);
  });
});
