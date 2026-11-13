import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const saveOrgSettings = vi.fn();
const current = vi.fn();
const remove = vi.fn();
const redirect = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, saveOrgSettings, logo: { current, remove } }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirect(to);
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const { saveSettingsAction } = await import("./actions");

const ORG = "11111111-1111-4111-8111-111111111111";
const OLD = `${ORG}/0b1c2f0e-1111-4222-8333-444455556666.png`;
const NEW = `${ORG}/0b1c2f0e-1111-4222-8333-777788889999.jpg`;
const FOREIGN = "6f1c2f0e-0000-4000-8000-000000000002/0b1c2f0e-1111-4222-8333-777788889999.jpg";
const REFUSED = "That logo is not one of this company's uploads";

const FIELDS: Record<string, string> = {
  legalName: "Kettle Ridge Mechanical Ltd.", address: "", phone: "", accentColor: "#1f6f8b", repairDiscountPct: "10", cpiCapPct: "5",
  cancellationNoticeDays: "30", paymentDays: "30", governingProvince: "BC", taxNote: "", defaultTermMonths: "12", renewalNoticeDays: "30",
  cpiRenegotiationThresholdPct: "5", renewalCpiPct: "", renewalCpiAsOf: "", proposalValidityDays: "30", itemSingular: "equipment", itemPlural: "equipment",
};
const form = (extra: Record<string, string> = {}) => {
  const data = new FormData();
  for (const [name, value] of Object.entries({ ...FIELDS, ...extra })) data.set(name, value);
  return data;
};
const idle = { status: "idle" } as const;

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "o@example.com", orgId: ORG, orgName: "Org", role: "owner" });
  saveOrgSettings.mockResolvedValue({ ok: true });
  current.mockResolvedValue(OLD);
  remove.mockResolvedValue(undefined);
});

describe("saveSettingsAction, logo", () => {
  test("C3312: a new valid logoPath is stored with the settings and the previous object is deleted", async () => {
    const state = await saveSettingsAction(idle, form({ logoPath: NEW }));
    expect(state.status).toBe("saved");
    expect(saveOrgSettings).toHaveBeenCalledWith(ORG, expect.objectContaining({ legalName: "Kettle Ridge Mechanical Ltd.", logoPath: NEW }));
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(OLD);
  });

  test("C3312: the same path as the stored one is stored again and deletes nothing", async () => {
    await saveSettingsAction(idle, form({ logoPath: OLD }));
    expect(saveOrgSettings).toHaveBeenCalledWith(ORG, expect.objectContaining({ logoPath: OLD }));
    expect(remove).not.toHaveBeenCalled();
  });

  test("C3312: a first logo (nothing stored) deletes nothing", async () => {
    current.mockResolvedValue(null);
    await saveSettingsAction(idle, form({ logoPath: NEW }));
    expect(saveOrgSettings).toHaveBeenCalledWith(ORG, expect.objectContaining({ logoPath: NEW }));
    expect(remove).not.toHaveBeenCalled();
  });

  test("C3313: IF Storage fails to delete the previous object THEN the save still reports success and exactly one error line is logged", async () => {
    const { supabaseOrgLogo } = await import("@/infrastructure/supabase/org-logo");
    const { stubClient } = await import("@/infrastructure/supabase/stub-client");
    const stub = stubClient({}, { remove: { data: null, error: { message: "storage is down" } } });
    const real = supabaseOrgLogo(stub.typed, { baseUrl: "https://x.supabase.co" });
    remove.mockImplementation(real.remove);
    const error = vi.spyOn(console, "error").mockImplementation(() => {});

    const state = await saveSettingsAction(idle, form({ logoPath: NEW }));

    expect(state.status).toBe("saved");
    expect(stub.calls.filter((c) => c.method === "remove").map((c) => c.args)).toEqual([[[OLD]]]);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });

  test("C3314: an empty logoPath stores null and deletes the previous object", async () => {
    const state = await saveSettingsAction(idle, form({ logoPath: "" }));
    expect(state.status).toBe("saved");
    expect(saveOrgSettings).toHaveBeenCalledWith(ORG, expect.objectContaining({ logoPath: null }));
    expect(remove).toHaveBeenCalledWith(OLD);
  });

  test.each([
    ["another org's key", FOREIGN],
    ["a name with no uuid", `${ORG}/logo.png`],
    ["an svg", `${ORG}/0b1c2f0e-1111-4222-8333-777788889999.svg`],
  ])("C3315: %s is a field error on logoPath, stores nothing and deletes nothing", async (_name, logoPath) => {
    const state = await saveSettingsAction(idle, form({ logoPath }));
    expect(state).toMatchObject({ status: "invalid", errors: { logoPath: REFUSED } });
    expect(saveOrgSettings).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  test.each(["forbidden", "unavailable"] as const)("C3316: a %s save does not delete the previous object", async (code) => {
    saveOrgSettings.mockResolvedValue({ ok: false, code });
    const state = await saveSettingsAction(idle, form({ logoPath: NEW }));
    expect(state.status).toBe(code);
    expect(remove).not.toHaveBeenCalled();
  });

  test("a form that carries no logoPath leaves the stored logo alone: nothing read, nothing written under logoPath, nothing deleted", async () => {
    await saveSettingsAction(idle, form());
    expect(saveOrgSettings.mock.calls[0][1]).not.toHaveProperty("logoPath");
    expect(current).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  test("a failing read of the stored logo does not stop the save", async () => {
    current.mockRejectedValue(new Error("down"));
    expect((await saveSettingsAction(idle, form({ logoPath: NEW }))).status).toBe("saved");
    expect(remove).not.toHaveBeenCalled();
  });
});
