import { NextRequest } from "next/server";
import { describe, expect, test, vi } from "vitest";
import type { AgreementDetail, ContractDetail, CurrentMember } from "@/application/ports";
import { contractClauses } from "@/domain/contract";
import type { OrgSettingsValue } from "@/domain/org-settings";
import { reactPdfContractRenderer } from "@/infrastructure/documents";
import { pdfPages } from "@/infrastructure/documents/pdf-text.testing";

// The composition root is where the route and the real PDF adapter meet, so this is the one place a test may hold both (AD-111).
const CON = "66666666-6666-4666-8666-666666666666";
const AGR = "11111111-1111-4111-8111-111111111111";

const SETTINGS: OrgSettingsValue = {
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
  defaultTermMonths: 12,
  renewalNoticeDays: 30,
  cpiRenegotiationThresholdPct: 5,
  renewalCpiPct: null,
  renewalCpiAsOf: null,
  proposalValidityDays: 30, itemSingular: "equipment", itemPlural: "equipment",
};

const TERMS = { repairDiscountPct: 10, cpiCapPct: 5, cancellationNoticeDays: 60, paymentDays: 30, governingProvince: "BC", taxNote: "GST extra", renewalNoticeDays: 30, cpiRenegotiationThresholdPct: 5 };

const detail = {
  id: AGR,
  number: "AG-1052",
  status: "accepted",
  site: { id: "s1", name: "Fernwood Dental, Main" },
  customer: { id: "c1", name: "Fernwood Dental" },
  editable: false,
  shown: {
    versionNo: 1,
    current: true,
    lines: [{ id: "l1", position: 0, description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000, visitMonths: [3, 6, 9, 12], equipment: [{ id: "t-rtu", code: "RTU", name: "Rooftop unit" }] }],
    annualCents: 180000,
  },
  serviceScope: { source: "not_recorded" },
  terms: TERMS,
  term: { start: "2027-01-01", months: 12, end: "2027-12-31" },
  validUntil: null,
} as unknown as AgreementDetail;

const contract: ContractDetail = {
  id: CON,
  status: "pending_signature",
  agreementId: AGR,
  versionNo: 1,
  number: "AG-1052",
  createdAt: new Date("2026-11-05T18:00:00Z"),
  parties: {
    contractor: { legalName: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street", phone: "604-555-0100" },
    customer: { name: "Fernwood Dental" },
    site: { name: "Fernwood Dental, Main", address: "12 Oak Ave" },
    signer: { name: "Pat Lee", email: "pat@example.com" },
  },
};

const member: CurrentMember = { status: "member", userId: "u1", email: "u@example.com", orgId: "o1", orgName: "Kettle Ridge", role: "viewer" };
const container = {
  currentMember: async () => member,
  contractReader: { get: async () => contract },
  agreementReader: { get: async () => detail },
  getOrgSettings: async () => SETTINGS,
  contractRenderer: reactPdfContractRenderer,
  tenantLogo: async () => null,
};

vi.mock("@/composition", () => ({ getContainer: async () => container }));

const { GET } = await import("../app/(app)/contracts/[contractId]/pdf/route");

describe("the contract PDF route with the real renderer", () => {
  test("C1646: the body is a PDF with the title, the signer and every clause, named after the agreement", async () => {
    const response = await GET(new NextRequest(`http://localhost:3000/contracts/${CON}/pdf`), { params: Promise.resolve({ contractId: CON }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="AG-1052-contract.pdf"');
    const body = Buffer.from(await response.arrayBuffer());
    expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(body.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);

    const text = pdfPages(body).join("\n").replace(/-\n/g, "").replace(/\s+/g, "");
    expect(text).toContain("ServiceContract");
    expect(text).toContain("PatLee");
    for (const clause of contractClauses(TERMS, 12)) expect(text, clause).toContain(clause.replace(/\s+/g, ""));
  });
});
