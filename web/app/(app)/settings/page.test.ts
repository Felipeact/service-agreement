import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const getOrgSettings = vi.fn(async () => ({ legalName: "Org" }));
const billingLink = vi.fn();
const logoCurrent = vi.fn(async () => null);
const redirect = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, getOrgSettings, billingLink, logo: { current: logoCurrent } }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirect(to);
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const { default: SettingsPage } = await import("./page");
const { SettingsView } = await import("@/app/(app)/settings/_components/content");

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "o@example.com", orgId: "org-1", orgName: "Org", role: "admin" });
  billingLink.mockResolvedValue(true);
});

describe("the Settings page", () => {
  test("C3128: it asks the container whether to show the Billing link for this member's org and role, once, and hands the answer to SettingsView", async () => {
    const element = (await SettingsPage()) as { type: unknown; props: Record<string, unknown> };
    expect(billingLink).toHaveBeenCalledTimes(1);
    expect(billingLink).toHaveBeenCalledWith("org-1", "admin");
    expect(element.type).toBe(SettingsView);
    expect(element.props.billingLink).toBe(true);
    expect(element.props.role).toBe("admin");
  });

  test("C3128: an answer of false is handed on as false", async () => {
    billingLink.mockResolvedValue(false);
    const element = (await SettingsPage()) as { props: Record<string, unknown> };
    expect(element.props.billingLink).toBe(false);
  });

  test("C3128: a signed-out visitor goes to /login and no billing read happens", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(SettingsPage()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(billingLink).not.toHaveBeenCalled();
  });
});

describe("the company-details banner", () => {
  const BANNER = "Confirm your company details before you send agreements";
  const REAL = {
    legalName: "Acme Heating Ltd.",
    address: "12 Main St, Surrey, BC V3T 1A1",
    phone: "604-555-2368",
    accentColor: "#1f6f8b",
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
  const html = (settings: Record<string, unknown>) =>
    renderToStaticMarkup(createElement(SettingsView, { settings: settings as never, role: "owner", action: vi.fn() as never }));

  test.each([
    ["never confirmed", { ...REAL, companyConfirmedAt: null }],
    ["confirmed once but the phone is the sample", { ...REAL, phone: "604-555-0100", companyConfirmedAt: new Date() }],
    ["an empty address", { ...REAL, address: null, companyConfirmedAt: new Date() }],
  ])("C6020: %s shows the banner", (_label, settings) => {
    expect(html(settings)).toContain(BANNER);
  });

  test("C6020: real, confirmed details show no banner", () => {
    expect(html({ ...REAL, companyConfirmedAt: new Date() })).not.toContain(BANNER);
  });
});
