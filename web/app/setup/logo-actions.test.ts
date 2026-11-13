import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const saveSetupProfile = vi.fn();
const skipSetup = vi.fn();
const current = vi.fn();
const remove = vi.fn();
const redirect = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, saveSetupProfile, skipSetup, logo: { current, remove } }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    redirect(to);
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));

const { setupAction } = await import("./actions");

const ORG = "11111111-1111-4111-8111-111111111111";
const OLD = `${ORG}/0b1c2f0e-1111-4222-8333-444455556666.png`;
const NEW = `${ORG}/0b1c2f0e-1111-4222-8333-777788889999.png`;
const FOREIGN = "6f1c2f0e-0000-4000-8000-000000000002/0b1c2f0e-1111-4222-8333-777788889999.png";
const REFUSED = "That logo is not one of this company's uploads";

const FIELDS = { legalName: "Flow Plumbing Ltd.", address: "", phone: "604-555-0123", accentColor: "#1f6f8b", governingProvince: "BC", itemSingular: "fixture", itemPlural: "fixtures" };
const form = (intent: string, extra: Record<string, string> = {}) => {
  const data = new FormData();
  for (const [name, value] of Object.entries({ ...FIELDS, intent, ...extra })) data.set(name, value);
  return data;
};
const idle = { status: "idle" } as const;

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "o@example.com", orgId: ORG, orgName: "Org", role: "owner" });
  saveSetupProfile.mockResolvedValue({ ok: true });
  skipSetup.mockResolvedValue({ ok: true });
  current.mockResolvedValue(null);
  remove.mockResolvedValue(undefined);
});

describe("setupAction, logo", () => {
  test("C3317: Continue with a valid logoPath stores it with the profile and goes to /pipeline", async () => {
    await expect(setupAction(idle, form("save", { logoPath: NEW }))).rejects.toThrow("NEXT_REDIRECT /pipeline");
    expect(saveSetupProfile).toHaveBeenCalledWith(ORG, expect.objectContaining({ legalName: "Flow Plumbing Ltd.", governingProvince: "BC", logoPath: NEW }));
    expect(remove).not.toHaveBeenCalled();
  });

  test("C3317: replacing a logo that was already stored deletes the old object after the save", async () => {
    current.mockResolvedValue(OLD);
    await expect(setupAction(idle, form("save", { logoPath: NEW }))).rejects.toThrow("NEXT_REDIRECT /pipeline");
    expect(remove).toHaveBeenCalledWith(OLD);
  });

  test("C3315: a logoPath of another org is a field error on logoPath, stores nothing and does not stamp setup", async () => {
    const state = await setupAction(idle, form("save", { logoPath: FOREIGN }));
    expect(state).toMatchObject({ status: "invalid", errors: { logoPath: REFUSED } });
    expect(saveSetupProfile).not.toHaveBeenCalled();
    expect(skipSetup).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  test("C3315: a field error elsewhere and a bad logoPath are returned together", async () => {
    const state = await setupAction(idle, form("save", { logoPath: FOREIGN, governingProvince: "" }));
    expect(state).toMatchObject({ status: "invalid", errors: { logoPath: expect.any(String), governingProvince: expect.any(String) } });
  });

  test("C3318: Skip for now stamps setup and writes nothing else: no profile, no logo, nothing read or deleted", async () => {
    await expect(setupAction(idle, form("skip", { logoPath: NEW }))).rejects.toThrow("NEXT_REDIRECT /pipeline");
    expect(skipSetup).toHaveBeenCalledWith(ORG);
    expect(saveSetupProfile).not.toHaveBeenCalled();
    expect(current).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });
});
