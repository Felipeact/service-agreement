import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();

vi.mock("@/composition", () => ({
  getContainer: async () => ({
    currentMember,
    pipelineBoard: async () => [],
    clock: { now: () => new Date("2027-06-15T20:00:00Z") },
    getItemWords: async () => ({ singular: "equipment", plural: "equipment" }),
    loadBillingUsage: async () => null,
    memberPlan: async () => null,
    workspaceState: async () => "none",
  }),
}));
vi.mock("next/navigation", () => ({ redirect: () => undefined, usePathname: () => "/pipeline" }));

const { MemberGate } = await import("../member-gate");

const as = (role: "owner" | "admin" | "estimator" | "viewer", extra: Partial<Extract<CurrentMember, { status: "member" }>> = {}) =>
  currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "o@example.com", orgId: "org-1", orgName: "Org", role, ...extra });

beforeEach(() => vi.clearAllMocks());

describe("the Reports link in the shell", () => {
  test.each([
    ["owner", true],
    ["admin", true],
    ["estimator", true],
    ["viewer", false],
  ] as const)("C5743: for a %s the shell is told reports: %s", async (role, expected) => {
    as(role);
    const element = (await MemberGate({ children: null })) as { props: { reports: boolean } };
    expect(element.props.reports).toBe(expected);
  });

  test("C5743: a frozen workspace keeps the link for its owner, whose working role is viewer", async () => {
    as("viewer", { billingRole: "owner", frozen: true });
    const element = (await MemberGate({ children: null })) as { props: { reports: boolean } };
    expect(element.props.reports).toBe(true);
  });
});
