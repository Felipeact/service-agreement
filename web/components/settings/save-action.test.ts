import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const saveOrgSettings = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, saveOrgSettings }) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const { saveSettingsAction } = await import("@/app/(app)/settings/actions");

const FIELDS = {
  legalName: "Kettle Ridge Mechanical Ltd.", address: "", phone: "", accentColor: "", repairDiscountPct: "10", cpiCapPct: "5",
  cancellationNoticeDays: "30", paymentDays: "30", governingProvince: "BC", taxNote: "", defaultTermMonths: "12",
  renewalNoticeDays: "30", cpiRenegotiationThresholdPct: "5", proposalValidityDays: "30", itemSingular: "equipment", itemPlural: "equipment",
};

function form(renewalCpiPct: string, renewalCpiAsOf: string) {
  const data = new FormData();
  for (const [name, value] of Object.entries({ ...FIELDS, renewalCpiPct, renewalCpiAsOf })) data.set(name, value);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "owner@example.com", orgId: "org-1", orgName: "Org", role: "owner" });
});

describe("saveSettingsAction with the renewal CPI", () => {
  test.each([
    ["renewalCpiPct", "abc", "2027-10-15", "CPI must be a number from -20 to 100 with at most two decimals"],
    ["renewalCpiAsOf", "3.2", "2027-02-30", "Enter the date this CPI was published"],
    ["renewalCpiAsOf", "3.2", "", "Set both CPI and its date, or neither"],
  ])("C1170: an invalid %s (%s, %s) returns its error and saves nothing", async (field, pct, asOf, message) => {
    const state = await saveSettingsAction({ status: "idle" }, form(pct, asOf));
    expect(saveOrgSettings).not.toHaveBeenCalled();
    expect(state.status === "invalid" ? state.errors : {}).toEqual({ [field]: message });
  });
});

describe("saveSettingsAction with the proposal validity", () => {
  test("C1224: 0 days returns the field error and never saves", async () => {
    const data = form("", "");
    data.set("proposalValidityDays", "0");
    const state = await saveSettingsAction({ status: "idle" }, data);
    expect(saveOrgSettings).not.toHaveBeenCalled();
    expect(state.status === "invalid" ? state.errors : {}).toEqual({
      proposalValidityDays: "Proposal validity must be a whole number of days from 1 to 365",
    });
  });
});

describe("saveSettingsAction with the item words", () => {
  test("C2005: a singular of Station1 returns the field error, keeps what was typed and never saves", async () => {
    const data = form("", "");
    data.set("itemSingular", "Station1");
    const state = await saveSettingsAction({ status: "idle" }, data);
    expect(saveOrgSettings).not.toHaveBeenCalled();
    expect(state.status).toBe("invalid");
    if (state.status === "invalid") {
      expect(state.errors).toEqual({ itemSingular: "Use 1 to 30 letters, spaces, hyphens or apostrophes, starting with a letter" });
      expect(state.values.itemSingular).toBe("Station1");
    }
  });
});
