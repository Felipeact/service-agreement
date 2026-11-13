import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const listImportHistory = vi.fn();
const listSites = vi.fn();
const container = { currentMember, listImportHistory, listSites, getItemWords: async () => ({ singular: "equipment", plural: "equipment", Singular: "Equipment", Plural: "Equipment" }) };

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({ redirect, notFound: vi.fn(), usePathname: () => "/imports" }));

const { ImportsForRequest } = await import("./imports/page");
const { ImportBannerLauncher } = await import("./new-agreement-launcher");

const SITE = "00000000-0000-4000-8000-0000000000a1";
const member: CurrentMember = { status: "member", userId: "u1", email: "u@x.test", orgId: "o1", orgName: "Org", role: "viewer" };
const render = async (params: Record<string, string | string[] | undefined>) =>
  renderToStaticMarkup((await ImportsForRequest({ params })) as ReactElement);

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue(member);
  listImportHistory.mockResolvedValue([]);
  listSites.mockResolvedValue([{ id: SITE, name: "Tower A", customer: "Harbourview Strata" }]);
});

describe("/imports", () => {
  test("C1396: the parsed filter goes to the history reader, the sites fill the filter, and the view renders", async () => {
    const out = await render({ status: "attention", site: SITE });
    expect(listImportHistory).toHaveBeenCalledWith({ status: "attention", siteId: SITE });
    expect(listSites).toHaveBeenCalledWith({ showInactive: true });
    expect(out).toContain("Harbourview Strata");
    expect(out).toContain("No imports match");
  });

  test("C1396: an invalid filter reads the same as no filter", async () => {
    await render({ status: "bogus", site: "nope" });
    expect(listImportHistory).toHaveBeenCalledWith({});
  });

  test("C1395: signed out goes to /login and nothing is read", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(render({})).rejects.toThrow("NEXT_REDIRECT /login");
    expect(listImportHistory).not.toHaveBeenCalled();
    expect(listSites).not.toHaveBeenCalled();
  });
});

describe("/imports, the drop banner", () => {
  test.each([
    ["owner", true],
    ["admin", true],
    ["estimator", true],
    ["viewer", false],
  ] as const)("C5415: for role %s the history gets the New agreement banner: %s", async (role, shown) => {
    currentMember.mockResolvedValue({ ...member, role });
    const view = (await ImportsForRequest({ params: {} })) as ReactElement<{ banner?: ReactElement }>;
    expect(view.props.banner !== undefined).toBe(shown);
    if (shown) expect(view.props.banner!.type).toBe(ImportBannerLauncher);
  });
});
