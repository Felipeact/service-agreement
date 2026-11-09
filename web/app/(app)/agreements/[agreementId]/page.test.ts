import type { ReactElement } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AgreementDetail, CurrentMember, MemberRole } from "@/application/ports";
import type { AgreementActions } from "@/components/agreements/agreement-view";

const AGR = "11111111-1111-4111-8111-111111111111";
const CON = "66666666-6666-4666-8666-666666666666";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const create = vi.fn();
const get = vi.fn();
const container = { currentMember, agreementReader: { get }, contractStore: { create }, getItemWords: async () => ({ singular: "equipment", plural: "equipment", Singular: "Equipment", Plural: "Equipment" }) };

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { AgreementForRequest } = await import("./page");

const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "e@example.com", orgId: "org-1", orgName: "Org", role });

beforeEach(() => {
  currentMember.mockReset();
  create.mockReset();
  get.mockReset().mockResolvedValue({ id: AGR } as AgreementDetail);
});

const render = async () => (await AgreementForRequest({ agreementId: AGR, searchParams: Promise.resolve({}) } as never)) as ReactElement<{ actions?: AgreementActions }>;

describe("the agreement page binds generateContractAction", () => {
  test.each<MemberRole>(["owner", "admin", "estimator"])("C1627: a %s gets a generate action bound to the agreement", async (role) => {
    currentMember.mockResolvedValue(member(role));
    create.mockRejectedValue(new Error("stop"));
    const { actions } = (await render()).props;
    expect(typeof actions?.generate).toBe("function");
    await expect(actions?.generate?.()).rejects.toThrow("stop");
    expect(create).toHaveBeenCalledWith(AGR);
  });

  test("C1627: a viewer gets no actions at all, so no generate action", async () => {
    currentMember.mockResolvedValue(member("viewer"));
    expect((await render()).props.actions).toBeUndefined();
  });

  test("C1627: the action that lands on the contract passes through the page's binding", async () => {
    currentMember.mockResolvedValue(member("owner"));
    create.mockResolvedValue({ ok: true, id: CON });
    await expect((await render()).props.actions?.generate?.()).rejects.toThrow(`NEXT_REDIRECT /contracts/${CON}`);
  });
});
