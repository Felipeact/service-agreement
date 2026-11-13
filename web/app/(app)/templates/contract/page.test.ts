import { existsSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember, MemberRole } from "@/application/ports";
import { SYSTEM_CONTRACT_BODY, type ContractLayoutBody } from "@/domain/contract";

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const getContractWording = vi.fn();

vi.mock("@/composition", () => ({ getContainer: async () => ({ currentMember, getContractWording }) }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { default: ContractWordingPage } = await import("./page");

const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "u@x.test", orgId: "o1", orgName: "Org", role });
const OWN: ContractLayoutBody = {
  schema: 2,
  doc: { title: "PREVENTIVE MAINTENANCE SERVICE AGREEMENT", showMeta: false, pageHeader: "every", pageFooter: "letterhead" },
  layout: [
    { kind: "block", type: "heading", text: "1. Service provided" },
    { kind: "section", key: "price" },
    { kind: "section", key: "signatures", options: { customerLabel: "Client" } },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  currentMember.mockResolvedValue(member("owner"));
  getContractWording.mockResolvedValue({ ok: true, body: SYSTEM_CONTRACT_BODY, own: false });
});

const render = async () => renderToStaticMarkup((await ContractWordingPage()) as ReactElement);

describe("/templates/contract", () => {
  test.each(["owner", "admin"] as const)("C5552: a %s sees the system wording's rows while the org has none, with the contract preview beside the form", async (role) => {
    currentMember.mockResolvedValue(member(role));
    const html = await render();
    expect(html).toContain("Contract wording");
    expect(html).toContain("This is the standard wording.");
    expect(html).toContain('id="doc-title"');
    expect(html).toContain('value="Service Contract"');
    expect(html).toContain("Invoices are payable within {{terms.paymentDays}}.");
    expect(html).toContain("Signatures");
    const form = html.indexOf('<section aria-label="Contract wording form"');
    const preview = html.indexOf('<section aria-label="Preview"');
    expect(form).toBeGreaterThan(-1);
    expect(preview).toBeGreaterThan(form);
    expect(html.indexOf('id="doc-title"')).toBeLessThan(preview);
  });

  test("C5552: the org's own wording opens with its own options and rows, and says saving writes a new version", async () => {
    getContractWording.mockResolvedValue({ ok: true, body: OWN, own: true });
    const html = await render();
    expect(html).toContain("Saving writes a new version.");
    expect(html).toContain('value="PREVENTIVE MAINTENANCE SERVICE AGREEMENT"');
    expect(html).toContain("1. Service provided");
    expect(html).toContain('value="Client"');
    expect(html).not.toContain("Invoices are payable within {{terms.paymentDays}}.");
  });

  test("C5552: wording that cannot be read is an error page, not other wording", async () => {
    getContractWording.mockResolvedValue({ ok: false, code: "unavailable" });
    await expect(ContractWordingPage()).rejects.toThrow("could not be read");
  });

  test("C5558: signed out goes to /login and nothing is read", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    await expect(ContractWordingPage()).rejects.toThrow("NEXT_REDIRECT /login");
    expect(getContractWording).not.toHaveBeenCalled();
  });

  test.each(["estimator", "viewer"] as const)("C5558: a %s goes to /templates and nothing is read", async (role) => {
    currentMember.mockResolvedValue(member(role));
    await expect(ContractWordingPage()).rejects.toThrow("NEXT_REDIRECT /templates");
    expect(getContractWording).not.toHaveBeenCalled();
  });

  test("C5558: the route has a loading screen titled Contract wording that says it is loading", async () => {
    expect(existsSync(path.join(__dirname, "loading.tsx"))).toBe(true);
    const { default: Loading } = await import("./loading");
    const html = renderToStaticMarkup(createElement(Loading));
    expect(html).toContain("Contract wording");
    expect(html).toContain("Loading");
  });
});
