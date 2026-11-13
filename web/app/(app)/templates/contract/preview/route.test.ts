import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { ContractRenderer, CurrentMember, MemberRole } from "@/application/ports";
import { SYSTEM_CONTRACT_BODY, type ContractDocument } from "@/domain/contract";
import { contractFormFromBody, type ContractLayoutForm } from "@/domain/contract/layout-form";
import type { OrgSettingsValue } from "@/domain/org-settings";
import type { TenantLogo } from "@/domain/org-settings/logo";

const ORG = "22222222-2222-4222-8222-222222222222";

const SETTINGS: OrgSettingsValue = {
  legalName: "Kettle Ridge Mechanical Ltd.",
  address: "100 Sample Street",
  phone: "604-555-0100",
  accentColor: "#1f6f8b",
  repairDiscountPct: 10,
  cpiCapPct: 5,
  cancellationNoticeDays: 30,
  paymentDays: 30,
  governingProvince: "BC",
  taxNote: null,
  defaultTermMonths: 12,
  renewalNoticeDays: 30,
  cpiRenegotiationThresholdPct: 5,
  renewalCpiPct: null,
  renewalCpiAsOf: null,
  proposalValidityDays: 30,
  itemSingular: "equipment",
  itemPlural: "equipment",
};

const FORM: ContractLayoutForm = {
  ...contractFormFromBody(SYSTEM_CONTRACT_BODY),
  doc: { title: "PREVENTIVE MAINTENANCE SERVICE AGREEMENT", showMeta: false, pageHeader: "every", pageFooter: "letterhead" },
};

const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "u@example.com", orgId: ORG, orgName: "Kettle Ridge", role });

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const getOrgSettings = vi.fn<(orgId: string) => Promise<OrgSettingsValue | null>>();
const renderContract = vi.fn<ContractRenderer["renderContract"]>();
const tenantLogo = vi.fn<(orgId: string) => Promise<TenantLogo | null>>();
// Every write the container could make: none may be called.
const writes = { saveContractWording: vi.fn(), saveAgreementTemplate: vi.fn(), duplicateAgreementTemplate: vi.fn(), contractStore: { create: vi.fn() } };
const container = { currentMember, getOrgSettings, contractRenderer: { renderContract }, tenantLogo, clock: { now: () => new Date("2026-11-13T18:00:00Z") }, ...writes };
vi.mock("@/composition", () => ({ getContainer: async () => container }));

const { POST, maxDuration } = await import("./route");

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);
const post = (body: unknown = FORM, raw?: string) =>
  POST(new NextRequest("http://localhost:3000/templates/contract/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: raw ?? JSON.stringify(body) }));
const noWrites = () => {
  expect(writes.saveContractWording).not.toHaveBeenCalled();
  expect(writes.saveAgreementTemplate).not.toHaveBeenCalled();
  expect(writes.duplicateAgreementTemplate).not.toHaveBeenCalled();
  expect(writes.contractStore.create).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.restoreAllMocks();
  currentMember.mockReset().mockResolvedValue(member("owner"));
  getOrgSettings.mockReset().mockResolvedValue(SETTINGS);
  renderContract.mockReset().mockResolvedValue(pdf);
  tenantLogo.mockReset().mockResolvedValue(null);
  writes.saveContractWording.mockReset();
  writes.saveAgreementTemplate.mockReset();
  writes.duplicateAgreementTemplate.mockReset();
  writes.contractStore.create.mockReset();
});

describe("POST /templates/contract/preview, the document", () => {
  test.each<MemberRole>(["owner", "admin"])("C5555: a %s gets 200 application/pdf, private and not stored, with the renderer's bytes untouched", async (role) => {
    currentMember.mockResolvedValue(member(role));
    const response = await post();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(pdf);
    noWrites();
  });

  test("C5555: the renderer is called once with a contract document built from sample data and the posted layout and options", async () => {
    await post();
    expect(renderContract).toHaveBeenCalledTimes(1);
    const document: ContractDocument = renderContract.mock.calls[0][0];
    expect(document).toMatchObject({ number: "AG-0000", customerName: "Sample Customer Ltd.", site: { name: "Sample Site" } });
    expect(document.contractor).toMatchObject({ name: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street", phone: "604-555-0100" });
    expect(document.signer).toMatchObject({ name: "Sample Signer" });
    expect(document.doc).toEqual({ title: "PREVENTIVE MAINTENANCE SERVICE AGREEMENT", showMeta: false, pageHeader: "every", pageFooter: "letterhead" });
    expect(document.layout?.at(-1)).toMatchObject({ kind: "section", key: "signatures" });
    expect(document.layout?.[0]).toMatchObject({ kind: "section", key: "price" });
    expect(document.lines).toHaveLength(1);
    expect(getOrgSettings).toHaveBeenCalledWith(ORG);
    expect(tenantLogo).toHaveBeenCalledWith(ORG);
    noWrites();
  });

  test("C5555: the term of the sample starts today, in the business's calendar", async () => {
    await post();
    const document: ContractDocument = renderContract.mock.calls[0][0];
    expect(document.term).toContain("Nov 13, 2026");
  });

  test("C5555: the org's logo goes on the letterhead when it has one", async () => {
    const logo: TenantLogo = { bytes: new Uint8Array([1]), format: "png" };
    tenantLogo.mockResolvedValue(logo);
    await post();
    expect(renderContract.mock.calls[0][0].contractor.logo).toBe(logo);
  });

  test("C5555: the route allows at least twice the measured render time of a long document", () => {
    expect(maxDuration).toBeGreaterThanOrEqual(44);
  });
});

describe("POST /templates/contract/preview, who may call and what is refused", () => {
  test("C5556: signed out answers 401 with no body and renders nothing", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    const response = await post();
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("");
    expect(renderContract).not.toHaveBeenCalled();
    expect(getOrgSettings).not.toHaveBeenCalled();
    noWrites();
  });

  test.each<MemberRole>(["estimator", "viewer"])("C5556: a %s gets 403 and nothing is rendered or read", async (role) => {
    currentMember.mockResolvedValue(member(role));
    const response = await post();
    expect(response.status).toBe(403);
    expect(await response.text()).toBe("");
    expect(renderContract).not.toHaveBeenCalled();
    expect(getOrgSettings).not.toHaveBeenCalled();
    noWrites();
  });

  test("C5556: invalid values answer 422 with { errors: [{ field, message }] } on the rows, and render nothing", async () => {
    const [price, ...rest] = FORM.layout;
    const noSignatures = await post({ ...FORM, layout: [price, ...rest.filter((row) => !(row.kind === "section" && row.key === "signatures"))] });
    expect(noSignatures.status).toBe(422);
    expect(await noSignatures.json()).toEqual({ errors: [{ field: "layout", message: "The layout needs the signatures section." }] });
    const bad = await post({ ...FORM, layout: [price, { kind: "block", type: "clause", text: "{{nope}}", level: 2, indent: 0, pageBreakBefore: false }, ...rest] });
    expect(bad.status).toBe(422);
    expect(((await bad.json()) as { errors: { field: string; message: string }[] }).errors).toEqual([expect.objectContaining({ field: "layout.1.text", message: expect.stringContaining("unknown variable") })]);
    expect(renderContract).not.toHaveBeenCalled();
    noWrites();
  });

  test("C5556: a body that is not JSON, not the editor's shape or over the size cap answers 422 and renders nothing", async () => {
    expect((await post(undefined, "{not json")).status).toBe(422);
    expect((await post({ doc: 1, layout: [] })).status).toBe(422);
    expect((await post(undefined, JSON.stringify({ pad: "x".repeat(250_000) }))).status).toBe(422);
    expect(renderContract).not.toHaveBeenCalled();
    noWrites();
  });

  test("C5556: when the renderer throws the answer is 503 with no body, and nothing is written", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderContract.mockRejectedValue(new Error("renderer down"));
    const response = await post();
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
    noWrites();
  });

  test("C5556: an org with no settings row answers 503, not a crash", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getOrgSettings.mockResolvedValue(null);
    expect((await post()).status).toBe(503);
    expect(renderContract).not.toHaveBeenCalled();
    noWrites();
  });
});
