import { NextRequest } from "next/server";
import { describe, expect, test, vi } from "vitest";
import type { AgreementDetail, CurrentMember } from "@/application/ports";
import type { OrgSettingsValue } from "@/domain/org-settings";
import { reactPdfDocumentRenderer } from "@/infrastructure/documents";
import { pdfPages } from "@/infrastructure/documents/pdf-text.testing";

// The composition root is where the route and the real PDF adapter meet, so this is the one place a test may hold both.
const AGR = "11111111-1111-4111-8111-111111111111";

let SETTINGS: OrgSettingsValue = {
  legalName: "Kettle Ridge Mechanical Ltd.",
  address: null,
  phone: null,
  accentColor: null,
  repairDiscountPct: 10,
  cpiCapPct: 5,
  cancellationNoticeDays: null,
  paymentDays: null,
  governingProvince: null,
  taxNote: null,
};

let detail: AgreementDetail = {
  id: AGR,
  number: "AG-1052",
  status: "sent",
  stage: "sent",
  site: { id: "s1", name: "Fernwood Dental, Main" },
  customer: { id: "c1", name: "Fernwood Dental" },
  versions: [{ versionNo: 1, createdAt: new Date("2026-10-20T18:00:00Z") }],
  shown: {
    versionNo: 1,
    current: true,
    lines: [{ id: "l1", position: 0, description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000 }],
    annualCents: 180000,
  },
  editable: false,
  serviceScope: { source: "not_recorded" },
  terms: { repairDiscountPct: 10, cpiCapPct: 5, cancellationNoticeDays: 30, paymentDays: 30, governingProvince: "BC", taxNote: "GST extra" },
  portalLink: null,
  linkEmail: null,
};

const member: CurrentMember = { status: "member", userId: "u1", email: "u@example.com", orgId: "o1", orgName: "Kettle Ridge", role: "viewer" };
const container = {
  currentMember: async () => member,
  agreementReader: { get: async () => detail },
  getOrgSettings: async () => SETTINGS,
  documentRenderer: reactPdfDocumentRenderer,
};

vi.mock("@/composition", () => ({ getContainer: async () => container }));

const { GET } = await import("../app/(app)/agreements/[agreementId]/pdf/route");

const FROZEN = { repairDiscountPct: 10, cpiCapPct: 5, cancellationNoticeDays: 30, paymentDays: 30, governingProvince: "BC", taxNote: "GST extra" };
const BASE = detail;
const BASE_SETTINGS = SETTINGS;

const render = async (patch: Partial<AgreementDetail>, settings: Partial<OrgSettingsValue> = {}) => {
  detail = { ...BASE, ...patch };
  SETTINGS = { ...BASE_SETTINGS, ...settings };
  const response = await GET(new NextRequest(`http://localhost:3000/agreements/${AGR}/pdf`), { params: Promise.resolve({ agreementId: AGR }) });
  expect(response.status).toBe(200);
  return pdfPages(Buffer.from(await response.arrayBuffer())).join(" ");
};

describe("the staff PDF prints the terms from the real renderer", () => {
  test("C934: a frozen version prints its frozen terms, with the six labels in order", async () => {
    const text = await render({ editable: false, terms: FROZEN });
    const labels = ["Repair discount", "CPI cap", "Cancellation notice", "Payment terms", "Governing province", "Tax note"];
    const at = labels.map((label) => text.indexOf(label));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
    expect(text).toContain("10%");
    expect(text).toContain("30 days");
    expect(text).toContain("GST extra");
  });

  test("C934: a frozen version keeps its terms after the settings differ", async () => {
    const text = await render({ editable: false, terms: FROZEN }, { repairDiscountPct: 15, taxNote: "Changed" });
    expect(text).toContain("10%");
    expect(text).toContain("GST extra");
    expect(text).not.toContain("15%");
    expect(text).not.toContain("Changed");
  });

  test("C934: an editable draft prints the current settings' terms", async () => {
    const text = await render({ editable: true, terms: null }, { repairDiscountPct: 15, taxNote: "Changed" });
    expect(text).toContain("15%");
    expect(text).toContain("Changed");
    expect(text).not.toContain("GST extra");
  });

  test("C934: a past version of a draft is frozen and prints its own terms", async () => {
    const text = await render(
      { editable: false, terms: { ...FROZEN, repairDiscountPct: 7 }, shown: { ...BASE.shown!, versionNo: 1, current: false } },
      { repairDiscountPct: 15 },
    );
    expect(text).toContain("7%");
    expect(text).not.toContain("15%");
  });
});
