import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const getOrgSettings = vi.fn(async () => ({ legalName: "Org" }));
const billingSection = vi.fn();
const redirect = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, getOrgSettings, billingSection }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirect(to);
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const { default: SettingsPage } = await import("./page");
const { openBillingPortalAction } = await import("./billing-actions");
const { SettingsView } = await import("@/components/settings/settings-view");

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "o@example.com", orgId: "org-1", orgName: "Org", role: "admin" });
  billingSection.mockResolvedValue({ kind: "ready", planName: "Team" });
});

describe("the Settings page", () => {
  test("C2916: it asks the container for the section of this member's org and role and hands it, with the portal action, to SettingsView", async () => {
    const element = (await SettingsPage()) as { type: unknown; props: Record<string, unknown> };
    expect(billingSection).toHaveBeenCalledWith("org-1", "admin");
    expect(element.type).toBe(SettingsView);
    expect(element.props.billing).toEqual({ kind: "ready", planName: "Team" });
    expect(element.props.billingAction).toBe(openBillingPortalAction);
    expect(element.props.role).toBe("admin");
  });

  test("C2916: a signed-out visitor goes to /login and no billing read happens", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(SettingsPage()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(billingSection).not.toHaveBeenCalled();
  });
});
