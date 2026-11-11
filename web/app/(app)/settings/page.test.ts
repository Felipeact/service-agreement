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
const { SettingsView } = await import("@/components/settings/settings-view");

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
