import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";
import { itemWords } from "@/domain/org-settings";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const catalogDraftAllowed = vi.fn();

vi.mock("@/composition", () => ({
  getContainer: async () => ({
    currentMember,
    setupPending: async () => true,
    getOrgSettings: async () => ({ legalName: "Blue Water Pools" }),
    setupCatalog: async () => [],
    getItemWords: async () => itemWords("equipment", "equipment"),
    catalogDraftAllowed,
    logo: { current: async () => null },
  }),
}));
vi.mock("next/navigation", () => ({ redirect: (to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); } }));

const { SetupForRequest } = await import("./page");

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "o@x.test", orgId: "org-1", orgName: "Org", role: "owner" });
});

describe("the setup page and the draft panel", () => {
  test("C3428: an org that may draft is given the draft panel's add action, for its own org id", async () => {
    catalogDraftAllowed.mockResolvedValue(true);
    const element = (await SetupForRequest()) as { props: { draft?: { addTypes: unknown } } };
    expect(catalogDraftAllowed).toHaveBeenCalledWith("org-1");
    expect(typeof element.props.draft?.addTypes).toBe("function");
  });

  test("C3429: an org that may not draft is given no draft panel", async () => {
    catalogDraftAllowed.mockResolvedValue(false);
    const element = (await SetupForRequest()) as { props: { draft?: unknown } };
    expect(element.props.draft).toBeUndefined();
  });
});
