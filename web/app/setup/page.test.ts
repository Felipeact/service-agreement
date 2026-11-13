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

const strayCalls = vi.fn();
/** Every container member the page does not read is a spy that throws, so a write cannot happen unseen (setup-template-preview AC 10). */
const reads = { currentMember, setupPending, getOrgSettings, setupCatalog, getItemWords, logo: { current: logoCurrent } };
vi.mock("@/composition", () => ({
  getContainer: async () =>
    new Proxy(reads as Record<string, unknown>, {
      get: (target, key) =>
        key in target || key === "then"
          ? target[key as string]
          : (...args: unknown[]) => {
              strayCalls(String(key), ...args);
              throw new Error(`unexpected container call ${String(key)}`);
            },
    }),
}));
// Next's redirect() throws to stop the render; the double does the same.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirect(to);
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const { SetupForRequest } = await import("./page");
const { renderToStaticMarkup } = await import("react-dom/server");

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

describe("setup-template-preview on the page", () => {
  test("C5511: an owner gets the starter templates section with every other container member refusing to be called", async () => {
    currentMember.mockResolvedValue(member("owner"));
    getOrgSettings.mockResolvedValue({ legalName: "Flow", address: null, phone: null, accentColor: null, repairDiscountPct: 0, cpiCapPct: 5, cancellationNoticeDays: 30, paymentDays: 30, governingProvince: "BC", taxNote: null, defaultTermMonths: 12, renewalNoticeDays: 30, cpiRenegotiationThresholdPct: 5, renewalCpiPct: null, renewalCpiAsOf: null, proposalValidityDays: 30, itemSingular: "equipment", itemPlural: "equipment" });
    const markup = renderToStaticMarkup(await SetupForRequest());
    expect(markup).toContain("Your starter templates");
    expect(strayCalls).not.toHaveBeenCalled();
  });

  test.each([
    ["an estimator", () => currentMember.mockResolvedValue(member("estimator")), "/pipeline"],
    ["a signed-out visitor", () => currentMember.mockResolvedValue({ status: "signed_out" }), "/login"],
  ] as const)("C5515: %s is redirected and no settings are read", async (_who, arrange, to) => {
    arrange();
    await expect(SetupForRequest()).rejects.toThrow(`NEXT_REDIRECT ${to}`);
    expect(getOrgSettings).not.toHaveBeenCalled();
    expect(strayCalls).not.toHaveBeenCalled();
  });
});
