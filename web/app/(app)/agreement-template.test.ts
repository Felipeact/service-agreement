import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember, MemberRole } from "@/application/ports";

const AGR = "11111111-1111-4111-8111-111111111111";
const TEMPLATE = "22222222-2222-4222-8222-222222222222";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const setTemplate = vi.fn();
const revalidatePath = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, agreementStore: { setTemplate } }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: (...args: unknown[]) => revalidatePath(...args) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));

const { setAgreementTemplateAction } = await import("./agreement-actions");

const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "e@example.com", orgId: "org-1", orgName: "Org", role });

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue(member("estimator"));
  setTemplate.mockResolvedValue({ ok: true });
});

describe("setAgreementTemplateAction", () => {
  test("C7108: a viewer is forbidden and the store is never called", async () => {
    currentMember.mockResolvedValue(member("viewer"));
    expect(await setAgreementTemplateAction(AGR, TEMPLATE)).toEqual({ status: "forbidden" });
    expect(setTemplate).not.toHaveBeenCalled();
  });

  test.each([
    ["nope", TEMPLATE],
    [AGR, "nope"],
  ])("C7108: a malformed id (%s, %s) is not_found and the store is never called", async (agreement, template) => {
    expect(await setAgreementTemplateAction(agreement, template)).toEqual({ status: "not_found" });
    expect(setTemplate).not.toHaveBeenCalled();
  });

  test.each<MemberRole>(["owner", "admin", "estimator"])("C7108: a %s changes the template once and the page and the pipeline are revalidated", async (role) => {
    currentMember.mockResolvedValue(member(role));
    expect(await setAgreementTemplateAction(AGR, TEMPLATE)).toEqual({ status: "saved" });
    expect(setTemplate).toHaveBeenCalledTimes(1);
    expect(setTemplate).toHaveBeenCalledWith(AGR, TEMPLATE);
    expect(revalidatePath).toHaveBeenCalledWith(`/agreements/${AGR}`);
    expect(revalidatePath).toHaveBeenCalledWith("/pipeline");
  });

  test.each(["locked", "invalid_template", "not_found", "forbidden", "unavailable"])("C7108: the store's %s is returned and nothing is revalidated", async (code) => {
    setTemplate.mockResolvedValue({ ok: false, code });
    expect(await setAgreementTemplateAction(AGR, TEMPLATE)).toEqual({ status: code });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
