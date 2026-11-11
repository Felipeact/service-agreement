import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";
import { itemWords } from "@/domain/org-settings";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const setupPending = vi.fn();
const getOrgSettings = vi.fn();
const setupCatalog = vi.fn();
const getItemWords = vi.fn();
const logoCurrent = vi.fn();
const redirect = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, setupPending, getOrgSettings, setupCatalog, getItemWords, logo: { current: logoCurrent } }) }));
// Next's redirect() throws to stop the render; the double does the same.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirect(to);
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const { SetupForRequest } = await import("./page");

const member = (role: "owner" | "admin" | "estimator" | "viewer"): CurrentMember => ({
  status: "member", userId: "u1", email: "o@example.com", orgId: "org-1", orgName: "Org", role,
});

beforeEach(() => {
  vi.clearAllMocks();
  setupPending.mockResolvedValue(true);
  getOrgSettings.mockResolvedValue({ legalName: "Flow" });
  setupCatalog.mockResolvedValue([]);
  getItemWords.mockResolvedValue(itemWords("equipment", "equipment"));
  logoCurrent.mockResolvedValue(null);
});

describe("the setup page's entry decision", () => {
  test("C2807: signed out goes to /login", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(SetupForRequest()).rejects.toThrow("NEXT_REDIRECT /login");
  });

  test("C2807: a signed-in user with no membership goes to /pipeline", async () => {
    currentMember.mockResolvedValue({ status: "no_membership", email: "x@example.com" });
    await expect(SetupForRequest()).rejects.toThrow("NEXT_REDIRECT /pipeline");
    expect(setupPending).not.toHaveBeenCalled();
  });

  test.each(["estimator", "viewer"] as const)("C2807: a %s goes to /pipeline", async (role) => {
    currentMember.mockResolvedValue(member(role));
    await expect(SetupForRequest()).rejects.toThrow("NEXT_REDIRECT /pipeline");
    expect(setupCatalog).not.toHaveBeenCalled();
  });

  test("C2806: an owner whose setup is done goes to /pipeline", async () => {
    currentMember.mockResolvedValue(member("owner"));
    setupPending.mockResolvedValue(false);
    await expect(SetupForRequest()).rejects.toThrow("NEXT_REDIRECT /pipeline");
    expect(setupCatalog).not.toHaveBeenCalled();
  });

  test("C2808: an owner or admin of a pending org gets the screen, with no redirect", async () => {
    for (const role of ["owner", "admin"] as const) {
      currentMember.mockResolvedValue(member(role));
      const element = await SetupForRequest();
      expect(element).toBeTruthy();
    }
    expect(redirect).not.toHaveBeenCalled();
    expect(setupCatalog).toHaveBeenCalledTimes(2);
  });

  test("C2808: an org with no settings row goes to /pipeline", async () => {
    currentMember.mockResolvedValue(member("owner"));
    getOrgSettings.mockResolvedValue(null);
    await expect(SetupForRequest()).rejects.toThrow("NEXT_REDIRECT /pipeline");
  });
});
