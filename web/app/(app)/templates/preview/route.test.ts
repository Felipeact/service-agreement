import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CurrentMember, DocumentRenderer, MemberRole } from "@/application/ports";
import type { AgreementDocument } from "@/domain/agreement";
import { EMPTY_TEMPLATE_FORM, type TemplateFormInput } from "@/domain/agreement/template-form";
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

const FORM: TemplateFormInput = {
  ...EMPTY_TEMPLATE_FORM,
  name: "Quarterly HVAC",
  intro: "Welcome {{customer.name}}.",
  footer: "Thank you, {{tenant.legalName}}.",
  schedule: true,
  scope: false,
  termMonths: "24",
  lines: [
    { description: "Quarterly visit", visitMonths: [3, 6, 9, 12], assetTypeCodes: ["RTU"], costPerVisit: "$450.00" },
    { description: "Filter check", visitMonths: [6], assetTypeCodes: [], costPerVisit: "" },
  ],
};

const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "u@example.com", orgId: ORG, orgName: "Kettle Ridge", role });

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const getOrgSettings = vi.fn<(orgId: string) => Promise<OrgSettingsValue | null>>();
const renderAgreement = vi.fn<DocumentRenderer["renderAgreement"]>();
const tenantLogo = vi.fn<(orgId: string) => Promise<TenantLogo | null>>();
// Every write the container could make: none may be called.
const writes = { saveAgreementTemplate: vi.fn(), archiveAgreementTemplate: vi.fn(), duplicateAgreementTemplate: vi.fn(), agreementStore: { create: vi.fn() } };
const container = { currentMember, getOrgSettings, documentRenderer: { renderAgreement }, tenantLogo, ...writes };
vi.mock("@/composition", () => ({ getContainer: async () => container }));

const { POST, maxDuration } = await import("./route");

const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);
const post = (body: unknown = FORM, raw?: string) =>
  POST(new NextRequest("http://localhost:3000/templates/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: raw ?? JSON.stringify(body) }));
const noWrites = () => {
  expect(writes.saveAgreementTemplate).not.toHaveBeenCalled();
  expect(writes.archiveAgreementTemplate).not.toHaveBeenCalled();
  expect(writes.duplicateAgreementTemplate).not.toHaveBeenCalled();
  expect(writes.agreementStore.create).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.restoreAllMocks();
  currentMember.mockReset().mockResolvedValue(member("owner"));
  getOrgSettings.mockReset().mockResolvedValue(SETTINGS);
  renderAgreement.mockReset().mockResolvedValue(pdf);
  tenantLogo.mockReset().mockResolvedValue(null);
  Object.values(writes).forEach((fn) => ("mockReset" in fn ? fn.mockReset() : fn.create.mockReset()));
});

describe("POST /templates/preview, the document", () => {
  test.each<MemberRole>(["owner", "admin"])("C5435: a %s gets 200 application/pdf, private and not stored, with the renderer's bytes untouched", async (role) => {
    currentMember.mockResolvedValue(member(role));
    const response = await post();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(Buffer.from(await response.arrayBuffer()).equals(Buffer.from(pdf))).toBe(true);
    noWrites();
  });

  test("C5435: the renderer is called once with the sample document built from the posted values and the org's settings", async () => {
    await post();
    expect(renderAgreement).toHaveBeenCalledTimes(1);
    const document: AgreementDocument = renderAgreement.mock.calls[0][0];
    expect(document).toMatchObject({ number: "AG-0000", customerName: "Sample Customer Ltd.", siteName: "Sample Site", mark: "TEMPLATE PREVIEW" });
    expect(document.tenant).toMatchObject({ name: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street", phone: "604-555-0100", accent: "#1f6f8b" });
    expect(document.intro).toEqual([{ type: "paragraph", text: "Welcome Sample Customer Ltd.." }]);
    expect(document.footer).toEqual([{ type: "paragraph", text: "Thank you, Kettle Ridge Mechanical Ltd.." }]);
    expect(document.sections).toEqual({ schedule: true, scope: false });
    expect(document.lines).toEqual([
      { description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000 },
      { description: "Filter check", visitsPerYear: 1, costPerVisitCents: 0, annualCents: 0 },
    ]);
    expect(document.terms.map((term) => term.label)).toContain("Repair discount");
    expect(document.terms.find((term) => term.label === "Repair discount")?.value).toBe("10%");
    expect(getOrgSettings).toHaveBeenCalledWith(ORG);
    expect(tenantLogo).toHaveBeenCalledWith(ORG);
  });

  test("C5435: the org's logo goes on the letterhead when it has one", async () => {
    const logo: TenantLogo = { bytes: new Uint8Array([1]), format: "png" };
    tenantLogo.mockResolvedValue(logo);
    await post();
    expect(renderAgreement.mock.calls[0][0].tenant.logo).toBe(logo);
  });

  test("C5435: the same values drawn twice give the same document, and nothing is written either time", async () => {
    await post();
    await post();
    expect(renderAgreement.mock.calls[1][0]).toEqual(renderAgreement.mock.calls[0][0]);
    noWrites();
  });

  test("C5435: the route allows at least twice the measured render time of a long document", () => {
    expect(maxDuration).toBeGreaterThanOrEqual(44);
  });
});

describe("POST /templates/preview, who may call and what is refused", () => {
  test("C5437: signed out answers 401 with no body and renders nothing", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    const response = await post();
    expect(response.status).toBe(401);
    expect(await response.text()).toBe("");
    expect(renderAgreement).not.toHaveBeenCalled();
    noWrites();
  });

  test.each<MemberRole>(["estimator", "viewer"])("C5437: a %s answers 403 and renders nothing", async (role) => {
    currentMember.mockResolvedValue(member(role));
    const response = await post();
    expect(response.status).toBe(403);
    expect(await response.text()).toBe("");
    expect(renderAgreement).not.toHaveBeenCalled();
    expect(getOrgSettings).not.toHaveBeenCalled();
    noWrites();
  });

  test("C5437: invalid values answer 422 with { errors: [{ field, message }] } and render nothing", async () => {
    const response = await post({ ...FORM, name: "x".repeat(81), termMonths: "61", lines: [{ ...FORM.lines[0], costPerVisit: "lots" }] });
    expect(response.status).toBe(422);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    const { errors } = (await response.json()) as { errors: { field: string; message: string }[] };
    expect(errors.map((error) => error.field).sort()).toEqual(["name", "preset.lines.0.costPerVisitCents", "preset.termMonths"]);
    for (const error of errors) expect(error.message).toEqual(expect.any(String));
    expect(renderAgreement).not.toHaveBeenCalled();
    noWrites();
  });

  test("C5435: a template with no name yet is still drawn, so a new template shows the Standard layout without an edit", async () => {
    const response = await post({ ...EMPTY_TEMPLATE_FORM });
    expect(response.status).toBe(200);
    expect(renderAgreement).toHaveBeenCalledTimes(1);
    expect(renderAgreement.mock.calls[0][0]).toMatchObject({ lines: [], sections: { schedule: true, scope: true } });
  });

  test.each<[string, unknown, string | undefined]>([
    ["a body that is not JSON", undefined, "{not json"],
    ["a JSON array", [], undefined],
    ["a field of the wrong type", { ...FORM, schedule: "yes" }, undefined],
    ["more lines than a template may hold", { ...FORM, lines: Array.from({ length: 21 }, () => FORM.lines[0]) }, undefined],
  ])("C5437: %s answers 422 naming a field and renders nothing", async (_label, body, raw) => {
    const response = await post(body, raw);
    expect(response.status).toBe(422);
    const { errors } = (await response.json()) as { errors: { field: string; message: string }[] };
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({ field: expect.any(String), message: expect.any(String) });
    expect(renderAgreement).not.toHaveBeenCalled();
  });

  test("C5437: a body larger than a template can be answers 422 without being read as JSON", async () => {
    const response = await post(undefined, JSON.stringify({ ...FORM, intro: "x".repeat(250_000) }));
    expect(response.status).toBe(422);
    expect(renderAgreement).not.toHaveBeenCalled();
  });

  test("C5437: when the renderer throws the answer is 503 with no body, and nothing is written", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderAgreement.mockRejectedValue(new Error("react-pdf failed"));
    const response = await post();
    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
    noWrites();
  });

  test("C5437: an org with no settings row answers 503, not a crash", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getOrgSettings.mockResolvedValue(null);
    expect((await post()).status).toBe(503);
    expect(renderAgreement).not.toHaveBeenCalled();
  });
});
