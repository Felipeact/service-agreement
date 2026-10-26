import { createElement, isValidElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember } from "@/application/ports";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const customerDetail = vi.fn();
const siteRegister = vi.fn();
const saveOrgSettings = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const redirect = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT ${path}`);
});

vi.mock("@/composition", () => ({
  getContainer: async () => ({ currentMember, customerDetail, siteRegister, saveOrgSettings }),
}));
vi.mock("next/navigation", () => ({ notFound, redirect, usePathname: () => "/pipeline" }));

const { default: CustomerPage } = await import("./customers/[customerId]/page");
const { default: SitePage } = await import("./sites/[siteId]/page");
const { default: NotFound } = await import("./not-found");
const { default: AppError } = await import("./error");
const { saveSettingsAction } = await import("./settings/actions");

const loadings = {
  "/pipeline": ["Pipeline", () => import("./pipeline/loading")],
  "/customers": ["Customers", () => import("./customers/loading")],
  "/customers/[customerId]": ["Customer", () => import("./customers/[customerId]/loading")],
  "/sites/[siteId]": ["Site", () => import("./sites/[siteId]/loading")],
  "/settings": ["Settings", () => import("./settings/loading")],
} as const;

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue({ status: "member", userId: "u1", email: "owner@example.com", orgId: "org-1", orgName: "Org", role: "owner" });
});

describe("screen states", () => {
  test.each(Object.entries(loadings))("C102: %s shows its header and a Loading… status", async (_route, [title, load]) => {
    const { default: Loading } = await load();
    const html = renderToStaticMarkup(createElement(Loading));
    expect(html).toMatch(new RegExp(`<h1[^>]*>${title}</h1>`));
    expect(html).toMatch(/<p[^>]*role="status"[^>]*>Loading…<\/p>/);
  });

  test("C103: the error boundary says so and Try again calls reset once", () => {
    const reset = vi.fn();
    const tree = AppError({ error: new Error("boom"), reset }) as ReactElement<{ children: ReactElement<{ onClick: () => void }> }>;
    expect(renderToStaticMarkup(tree)).toContain("Something went wrong");
    expect(renderToStaticMarkup(tree)).toMatch(/<button[^>]*>Try again</);

    const button = tree.props.children;
    expect(isValidElement(button)).toBe(true);
    button.props.onClick();
    expect(reset).toHaveBeenCalledTimes(1);
  });

  test("C105: the not-found page says Not found and links back to /customers", () => {
    const html = renderToStaticMarkup(NotFound());
    expect(html).toContain("Not found");
    expect(html).toMatch(/<a[^>]*href="\/customers"/);
  });

  test("C105: the customer page calls notFound when the reader returns null, and renders otherwise", async () => {
    customerDetail.mockResolvedValueOnce(null);
    await expect(CustomerPage({ params: Promise.resolve({ customerId: "x" }) } as never)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(customerDetail).toHaveBeenCalledWith("x");

    notFound.mockClear();
    customerDetail.mockResolvedValueOnce({ id: "x", name: "Alpha", contacts: [], sites: [], agreements: [] });
    await CustomerPage({ params: Promise.resolve({ customerId: "x" }) } as never);
    expect(notFound).not.toHaveBeenCalled();
  });

  test("C105: the site page calls notFound when the reader returns null, and renders otherwise", async () => {
    siteRegister.mockResolvedValueOnce(null);
    await expect(SitePage({ params: Promise.resolve({ siteId: "y" }) } as never)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(siteRegister).toHaveBeenCalledWith("y");

    notFound.mockClear();
    siteRegister.mockResolvedValueOnce({ id: "y", name: "S", address: null, customerId: "c", customerName: "C", contactName: null, assets: [] });
    await SitePage({ params: Promise.resolve({ siteId: "y" }) } as never);
    expect(notFound).not.toHaveBeenCalled();
  });
});

const member: CurrentMember = { status: "member", userId: "u1", email: "owner@example.com", orgId: "org-1", orgName: "Org", role: "owner" };

function form(patch: Record<string, string> = {}) {
  const data = new FormData();
  const fields = {
    legalName: "Acme Ltd.",
    address: "",
    phone: "",
    accentColor: "#1f6f8b",
    repairDiscountPct: "10",
    cpiCapPct: "5",
    cancellationNoticeDays: "30",
    paymentDays: "30",
    governingProvince: "BC",
    taxNote: "",
    ...patch,
  };
  for (const [name, value] of Object.entries(fields)) data.set(name, value);
  return data;
}

describe("saveSettingsAction", () => {
  test("C148: invalid input saves nothing and returns the errors with what was typed", async () => {
    currentMember.mockResolvedValue(member);
    const state = await saveSettingsAction({ status: "idle" }, form({ legalName: "", cpiCapPct: "abc" }));

    expect(saveOrgSettings).not.toHaveBeenCalled();
    expect(state).toMatchObject({ status: "invalid", values: { legalName: "", cpiCapPct: "abc", phone: "" } });
    expect(Object.keys(state.status === "invalid" ? state.errors : {}).sort()).toEqual(["cpiCapPct", "legalName"]);
  });

  test("C149: valid input is saved once for the member's org", async () => {
    currentMember.mockResolvedValue(member);
    saveOrgSettings.mockResolvedValue({ ok: true });
    const state = await saveSettingsAction({ status: "idle" }, form({ legalName: "  Acme Ltd.  " }));

    expect(saveOrgSettings).toHaveBeenCalledTimes(1);
    expect(saveOrgSettings.mock.calls[0][0]).toBe("org-1");
    expect(saveOrgSettings.mock.calls[0][1]).toMatchObject({ legalName: "Acme Ltd.", address: null, repairDiscountPct: 10 });
    expect(state.status).toBe("saved");
  });

  test.each(["forbidden", "unavailable"] as const)("C150/C151: a %s refusal comes back as that state with the values", async (code) => {
    currentMember.mockResolvedValue(member);
    saveOrgSettings.mockResolvedValue({ ok: false, code });
    const state = await saveSettingsAction({ status: "idle" }, form({ phone: "778-555-0199" }));
    expect(state).toMatchObject({ status: code, values: { phone: "778-555-0199" } });
  });

  test("a signed-out request is sent to /login before anything is saved", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(saveSettingsAction({ status: "idle" }, form())).rejects.toThrow("NEXT_REDIRECT /login");
    expect(saveOrgSettings).not.toHaveBeenCalled();
  });
});
