import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const listSites = vi.fn();
const listCustomers = vi.fn();
const container = { currentMember, listSites, listCustomers };

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({ redirect, notFound: vi.fn(), usePathname: () => "/sites" }));

const { SitesForRequest } = await import("./sites/page");

const CUSTOMER = "00000000-0000-4000-8000-0000000000c1";
const member: CurrentMember = { status: "member", userId: "u1", email: "u@x.test", orgId: "o1", orgName: "Org", role: "viewer" };
const render = async (params: Record<string, string | string[] | undefined>) =>
  renderToStaticMarkup((await SitesForRequest({ params })) as ReactElement);

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue(member);
  listSites.mockResolvedValue([]);
  listCustomers.mockResolvedValue([{ id: CUSTOMER, name: "Harbourview Strata", primaryContact: null, active: true, siteCount: 1, assetCount: 0 }]);
});

describe("/sites", () => {
  test("C1374: the parsed filter goes to the lister, the customers fill the filter, and the view renders", async () => {
    const out = await render({ q: " tower ", customer: CUSTOMER, show: "inactive" });
    expect(listSites).toHaveBeenCalledWith({ q: "tower", customerId: CUSTOMER, showInactive: true });
    expect(listCustomers).toHaveBeenCalledTimes(1);
    expect(out).toContain("Harbourview Strata");
    expect(out).toContain("No sites match");
  });

  test("C1374: an invalid customer reads the same as no customer", async () => {
    await render({ customer: "nope" });
    await render({});
    expect(listSites).toHaveBeenNthCalledWith(1, {});
    expect(listSites).toHaveBeenNthCalledWith(2, {});
  });

  test("C1375: signed out goes to /login and nothing is read", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(render({})).rejects.toThrow("NEXT_REDIRECT /login");
    expect(listSites).not.toHaveBeenCalled();
    expect(listCustomers).not.toHaveBeenCalled();
  });
});
