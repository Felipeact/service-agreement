import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember, MemberRole } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const create = vi.fn();
const container = { currentMember, contractStore: { create } };

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({ redirect }));

const { generateContractAction } = await import("./contract-actions");

const AGR = "11111111-1111-4111-8111-111111111111";
const CON = "66666666-6666-4666-8666-666666666666";
const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "e@example.com", orgId: "org-1", orgName: "Org", role });

beforeEach(() => {
  currentMember.mockReset().mockResolvedValue(member("estimator"));
  create.mockReset();
  redirect.mockClear();
});

describe("generateContractAction", () => {
  test("C1621: a viewer is forbidden and the store is never called", async () => {
    currentMember.mockResolvedValue(member("viewer"));
    expect(await generateContractAction(AGR)).toEqual({ status: "forbidden" });
    expect(create).not.toHaveBeenCalled();
  });

  test.each(["abc", ""])("C1621: the malformed id %j is not_found and the store is never called", async (id) => {
    expect(await generateContractAction(id)).toEqual({ status: "not_found" });
    expect(create).not.toHaveBeenCalled();
  });

  test.each<MemberRole>(["owner", "admin", "estimator"])("C1621: a %s generates once and lands on /contracts/<id>", async (role) => {
    currentMember.mockResolvedValue(member(role));
    create.mockResolvedValue({ ok: true, id: CON });
    await expect(generateContractAction(AGR)).rejects.toThrow(`NEXT_REDIRECT /contracts/${CON}`);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(AGR);
    expect(redirect).toHaveBeenCalledWith(`/contracts/${CON}`);
  });

  test.each(["not_accepted", "auto_renewal", "site_inactive", "no_term_start", "no_signer", "forbidden", "not_found", "unavailable"])(
    "C1621: the store's %s is the action's status",
    async (code) => {
      create.mockResolvedValue({ ok: false, code });
      expect(await generateContractAction(AGR)).toEqual({ status: code });
      expect(redirect).not.toHaveBeenCalled();
    },
  );

  test("C1621: signed out goes to /login and the store is never called", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(generateContractAction(AGR)).rejects.toThrow("NEXT_REDIRECT /login");
    expect(create).not.toHaveBeenCalled();
  });
});
