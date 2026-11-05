import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember, SearchResults } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const searchRecords = vi.fn<(query: string) => Promise<SearchResults>>();
const container = { currentMember, searchRecords };

const redirect = vi.fn((to: string) => {
  throw new Error(`NEXT_REDIRECT ${to}`);
});

vi.mock("@/composition", () => ({ getContainer: async () => container }));
vi.mock("next/navigation", () => ({ redirect, notFound: vi.fn(), usePathname: () => "/search" }));

const { SearchForRequest } = await import("./search/page");

const member: CurrentMember = { status: "member", userId: "u1", email: "u@x.test", orgId: "o1", orgName: "Org", role: "viewer" };
const none = { hits: [], more: false };
const render = async (params: Record<string, string | string[] | undefined>) =>
  renderToStaticMarkup((await SearchForRequest({ params })) as ReactElement);

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue(member);
  searchRecords.mockResolvedValue({ customers: none, sites: none, equipment: none });
});

describe("/search", () => {
  test("C1576: the parsed text goes to searchRecords and the three groups it returns are rendered", async () => {
    searchRecords.mockResolvedValue({
      customers: { hits: [{ id: "c1", name: "Harbourview Strata" }], more: false },
      sites: { hits: [{ id: "s1", name: "North Tower", customerName: "Harbourview Strata", address: null }], more: false },
      equipment: { hits: [{ id: "a1", siteId: "s1", unitNo: "RTU-3", typeName: "Rooftop unit", siteName: "North Tower", customerName: "Harbourview Strata" }], more: false },
    });
    const out = await render({ q: " tower " });
    expect(searchRecords).toHaveBeenCalledTimes(1);
    expect(searchRecords).toHaveBeenCalledWith("tower");
    expect(out).toContain("Customers");
    expect(out).toContain("Sites");
    expect(out).toContain("Equipment");
    expect(out).toContain('href="/customers/c1"');
    expect(out).toContain('href="/sites/s1"');
    expect(out).toContain("RTU-3");
  });

  test.each([[{}], [{ q: "" }], [{ q: "   " }], [{ q: ["a", "b"] }]])(
    "C1577: with q %j the prompt shows and searchRecords is not called",
    async (params) => {
      const out = await render(params);
      expect(out).toContain("Search customers, sites and equipment by name, address or unit number.");
      expect(searchRecords).not.toHaveBeenCalled();
    },
  );

  test("C1578: signed out redirects to /login and nothing is read", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(render({ q: "tower" })).rejects.toThrow("NEXT_REDIRECT /login");
    expect(redirect).toHaveBeenCalledWith("/login");
    expect(searchRecords).not.toHaveBeenCalled();
  });

  test("C1579: a rejected read rejects the page and renders nothing", async () => {
    searchRecords.mockRejectedValue(new Error("Supabase error XX000: boom"));
    await expect(render({ q: "tower" })).rejects.toThrow("XX000");
  });
});
