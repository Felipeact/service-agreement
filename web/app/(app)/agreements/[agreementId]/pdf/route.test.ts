import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AgreementDetail, CurrentMember, DocumentRenderer, MemberRole } from "@/application/ports";
import type { OrgSettingsValue } from "@/domain/org-settings";

const AGR = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";

const SETTINGS: OrgSettingsValue = {
  legalName: "Kettle Ridge Mechanical Ltd.",
  address: "100 Sample Street, Burnaby, BC",
  phone: "604-555-0100",
  accentColor: "#1f6f8b",
  repairDiscountPct: 10,
  cpiCapPct: 5,
  cancellationNoticeDays: 30,
  paymentDays: 30,
  governingProvince: "BC",
  taxNote: "GST extra",
};

function detail(over: Partial<AgreementDetail> = {}, versionNo = 1): AgreementDetail {
  return {
    id: AGR,
    number: "AG-1052",
    status: "sent",
    stage: "sent",
    site: { id: "s1", name: "Fernwood Dental, Main" },
    customer: { id: "c1", name: "Fernwood Dental" },
    versions: [{ versionNo, createdAt: new Date("2026-10-20T18:00:00Z") }],
    shown: {
      versionNo,
      current: true,
      lines: [{ id: "l1", position: 0, description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000 }],
      annualCents: 180000,
    },
    editable: false,
    serviceScope: { source: "frozen", takenAt: new Date("2026-10-20T15:00:00Z"), types: [] },
    ...over,
  };
}

const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "u@example.com", orgId: ORG, orgName: "Kettle Ridge", role });

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const get = vi.fn<(id: string, versionNo?: number) => Promise<AgreementDetail | null>>();
const getOrgSettings = vi.fn<(orgId: string) => Promise<OrgSettingsValue | null>>();
const renderAgreement = vi.fn<DocumentRenderer["renderAgreement"]>();
const container = { currentMember, agreementReader: { get }, getOrgSettings, documentRenderer: { renderAgreement } };

vi.mock("@/composition", () => ({ getContainer: async () => container }));

const { GET } = await import("./route");

const call = (id = AGR, query = "") =>
  GET(new NextRequest(`http://localhost:3000/agreements/${id}/pdf${query}`), { params: Promise.resolve({ agreementId: id }) });

const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);

beforeEach(() => {
  vi.restoreAllMocks();
  currentMember.mockReset().mockResolvedValue(member("estimator"));
  get.mockReset().mockResolvedValue(detail());
  getOrgSettings.mockReset().mockResolvedValue(SETTINGS);
  renderAgreement.mockReset().mockResolvedValue(bytes);
});

describe("GET /agreements/[agreementId]/pdf", () => {
  test("C851: a member gets 200, application/pdf, and the renderer's bytes untouched", async () => {
    const response = await call();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    const body = Buffer.from(await response.arrayBuffer());
    expect(body.equals(Buffer.from(bytes))).toBe(true);
  });

  test.each<[string, string, number | undefined]>([
    ["?version=2", "?version=2", 2],
    ["no query", "", undefined],
    ["?version=abc", "?version=abc", undefined],
    ["?version=1.5", "?version=1.5", undefined],
    ["?version=0", "?version=0", undefined],
    ["?version=-1", "?version=-1", undefined],
    ["?version=2abc", "?version=2abc", undefined],
  ])("C852: %s asks the reader for version %s", async (_name, query, expected) => {
    await call(AGR, query);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(AGR, expected);
  });

  test("C853: the file is named after the agreement number and the version rendered", async () => {
    expect((await call()).headers.get("Content-Disposition")).toBe('attachment; filename="AG-1052-v1.pdf"');

    get.mockResolvedValue(detail({}, 2));
    expect((await call(AGR, "?version=9")).headers.get("Content-Disposition")).toBe('attachment; filename="AG-1052-v2.pdf"');
  });

  test.each<[string, string, () => void]>([
    ["a malformed id", "not-a-uuid", () => {}],
    ["a missing agreement", AGR, () => get.mockResolvedValue(null)],
    ["another org's agreement", AGR, () => get.mockResolvedValue(null)],
  ])("C854: %s answers an empty 404 and renders nothing", async (_name, id, arrange) => {
    arrange();
    const response = await call(id);

    expect(response.status).toBe(404);
    const body = await response.text();
    expect(body).toBe("");
    expect(body).not.toContain("AG-1052");
    expect(body).not.toContain("Fernwood");
    expect(renderAgreement).not.toHaveBeenCalled();
    expect(getOrgSettings).not.toHaveBeenCalled();
  });

  test.each<MemberRole>(["owner", "admin", "estimator", "viewer"])("C855: a %s gets 200", async (role) => {
    currentMember.mockResolvedValue(member(role));
    expect((await call()).status).toBe(200);
  });

  test("C856: a request with no member never reads or renders, and is sent to /login", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    const response = await call();

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") as string).pathname).toBe("/login");
    expect(get).not.toHaveBeenCalled();
    expect(renderAgreement).not.toHaveBeenCalled();
  });

  test("C868: a version with no recorded scope still answers 200", async () => {
    get.mockResolvedValue(detail({ serviceScope: { source: "not_recorded" } }));
    expect((await call()).status).toBe(200);
    expect(renderAgreement.mock.calls[0][0].scope).toEqual({ kind: "not_recorded" });
  });

  test("C866: the draft mark is handed over only for the current version of a draft", async () => {
    get.mockResolvedValue(detail({ status: "draft", stage: "in_progress", editable: true, serviceScope: { source: "live", takenAt: null, types: [] } }));
    await call();
    expect(renderAgreement.mock.calls[0][0].mark).toBe("DRAFT - not yet sent to the customer");

    get.mockResolvedValue(detail({ status: "draft", stage: "in_progress", editable: false }, 1));
    await call(AGR, "?version=1");
    expect(renderAgreement.mock.calls[1][0].mark).toBeNull();

    get.mockResolvedValue(detail());
    await call();
    expect(renderAgreement.mock.calls[2][0].mark).toBeNull();
  });

  test("the document handed to the renderer is the agreement with the org's settings", async () => {
    await call();
    const document = renderAgreement.mock.calls[0][0];
    expect(getOrgSettings).toHaveBeenCalledWith(ORG);
    expect(document.tenant.name).toBe("Kettle Ridge Mechanical Ltd.");
    expect(document.number).toBe("AG-1052");
    expect(document.totalCents).toBe(180000);
  });

  test.each<[string, () => void]>([
    ["the renderer rejects", () => renderAgreement.mockRejectedValue(new Error("layout failed"))],
    ["the settings read rejects", () => getOrgSettings.mockRejectedValue(new Error("db down"))],
    ["the org has no settings row", () => getOrgSettings.mockResolvedValue(null)],
  ])("C869: when %s the route answers an empty 503, logs the cause and sends no bytes", async (_name, arrange) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    arrange();
    const response = await call();

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
    expect(response.headers.get("Content-Type")).not.toBe("application/pdf");
    expect(log).toHaveBeenCalledTimes(1);
  });

  test("C869: a reader that rejects is not caught by the route", async () => {
    get.mockRejectedValue(new Error("db down"));
    await expect(call()).rejects.toThrow("db down");
  });

  test("C870: the route allows at least twice the measured 22 s render of 2,000 assets", async () => {
    const { maxDuration } = await import("./route");
    expect(maxDuration).toBeGreaterThanOrEqual(44);
  });
});
