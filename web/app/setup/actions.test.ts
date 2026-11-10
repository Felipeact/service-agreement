import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const saveSetupProfile = vi.fn();
const skipSetup = vi.fn();
const redirect = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, saveSetupProfile, skipSetup }) }));
// Next's redirect() throws to stop the action; the double does the same, so code after it cannot run.
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirect(to);
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const { setupAction } = await import("./actions");

const FIELDS = {
  legalName: "Flow Plumbing Ltd.",
  address: "",
  phone: "604-555-0123",
  accentColor: "#1f6f8b",
  governingProvince: "BC",
  itemSingular: "fixture",
  itemPlural: "fixtures",
};

function form(intent: string, change: Record<string, string> = {}) {
  const data = new FormData();
  for (const [name, value] of Object.entries({ ...FIELDS, intent, ...change })) data.set(name, value);
  return data;
}

const idle = { status: "idle" } as const;

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "owner@example.com", orgId: "org-1", orgName: "Org", role: "owner" });
  saveSetupProfile.mockResolvedValue({ ok: true });
  skipSetup.mockResolvedValue({ ok: true });
});

describe("setupAction", () => {
  test("C2809: a valid save stores the validated profile for the member's org and redirects to /pipeline", async () => {
    await expect(setupAction(idle, form("save"))).rejects.toThrow("NEXT_REDIRECT /pipeline");
    expect(saveSetupProfile).toHaveBeenCalledWith("org-1", {
      legalName: "Flow Plumbing Ltd.",
      address: null,
      phone: "604-555-0123",
      accentColor: "#1f6f8b",
      governingProvince: "BC",
      itemSingular: "fixture",
      itemPlural: "fixtures",
    });
    expect(skipSetup).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/pipeline");
  });

  test("C2810: an invalid save returns every error together, keeps what was typed, and stores and stamps nothing", async () => {
    const state = await setupAction(idle, form("save", { legalName: "", governingProvince: "", accentColor: "blue" }));
    expect(state.status).toBe("invalid");
    if (state.status === "invalid") {
      expect(Object.keys(state.errors).sort()).toEqual(["accentColor", "governingProvince", "legalName"]);
      expect(state.values.itemSingular).toBe("fixture");
    }
    expect(saveSetupProfile).not.toHaveBeenCalled();
    expect(skipSetup).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  test("C2811: a refused save shows forbidden, keeps the input and does not redirect", async () => {
    saveSetupProfile.mockResolvedValue({ ok: false, code: "forbidden" });
    const state = await setupAction(idle, form("save"));
    expect(state).toMatchObject({ status: "forbidden", values: { legalName: "Flow Plumbing Ltd." } });
    expect(redirect).not.toHaveBeenCalled();
  });

  test("C2811: an unavailable store shows unavailable and does not redirect", async () => {
    saveSetupProfile.mockResolvedValue({ ok: false, code: "unavailable" });
    expect((await setupAction(idle, form("save"))).status).toBe("unavailable");
    expect(redirect).not.toHaveBeenCalled();
  });

  test("C2812: skip stamps without validating or saving a profile, then redirects to /pipeline", async () => {
    await expect(setupAction(idle, form("skip", { legalName: "", governingProvince: "" }))).rejects.toThrow("NEXT_REDIRECT /pipeline");
    expect(skipSetup).toHaveBeenCalledWith("org-1");
    expect(saveSetupProfile).not.toHaveBeenCalled();
    expect(redirect).toHaveBeenCalledWith("/pipeline");
  });

  test("C2812: a skip the store cannot stamp shows unavailable and does not redirect", async () => {
    skipSetup.mockResolvedValue({ ok: false, code: "unavailable" });
    expect((await setupAction(idle, form("skip"))).status).toBe("unavailable");
    expect(redirect).not.toHaveBeenCalled();
  });

  test("C2807: a signed-out caller is sent to /login and nothing is stored", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(setupAction(idle, form("save"))).rejects.toThrow("NEXT_REDIRECT /login");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(saveSetupProfile).not.toHaveBeenCalled();
  });

  test.each(["estimator", "viewer"] as const)("C2811: a %s is sent to /pipeline and nothing is stored", async (role) => {
    currentMember.mockResolvedValue({ status: "member", userId: "u2", email: "x@example.com", orgId: "org-1", orgName: "Org", role });
    await expect(setupAction(idle, form("save"))).rejects.toThrow("NEXT_REDIRECT /pipeline");
    expect(redirect).toHaveBeenCalledWith("/pipeline");
    expect(saveSetupProfile).not.toHaveBeenCalled();
    expect(skipSetup).not.toHaveBeenCalled();
  });
});
