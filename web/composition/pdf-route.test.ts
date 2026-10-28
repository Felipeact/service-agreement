import { NextRequest } from "next/server";
import { describe, expect, test, vi } from "vitest";
import type { AgreementDetail, CurrentMember } from "@/application/ports";
import type { OrgSettingsValue } from "@/domain/org-settings";
import { reactPdfDocumentRenderer } from "@/infrastructure/documents";
import { pdfPages } from "@/infrastructure/documents/pdf-text.testing";

// The composition root is where the route and the real PDF adapter meet, so this is the one place a test may hold both.
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
};

const detail: AgreementDetail = {
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

describe("the PDF route with the real renderer", () => {
  test("C851: the body is a PDF that starts with %PDF- and ends with %%EOF", async () => {
    const response = await GET(new NextRequest(`http://localhost:3000/agreements/${AGR}/pdf`), { params: Promise.resolve({ agreementId: AGR }) });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    const body = Buffer.from(await response.arrayBuffer());
    expect(body.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(body.toString("latin1").trimEnd().endsWith("%%EOF")).toBe(true);
    expect(pdfPages(body)[0]).toContain("Kettle Ridge Mechanical Ltd.");
  });

  test("C870: a site with 2,000 assets answers 200 through the route, with every row in the PDF", async () => {
    const types = Array.from({ length: 40 }, (_, t) => ({
      code: `T${t + 1}`,
      name: `Type ${String(t + 1).padStart(2, "0")}`,
      tasks: ["Inspect"],
      assets: Array.from({ length: 50 }, (_, a) => ({ unitNo: `T${t + 1}-${a + 1}`, typeModel: null, location: null })),
    }));
    const big = { ...detail, serviceScope: { source: "frozen" as const, takenAt: new Date("2026-10-20T15:00:00Z"), types } };
    const original = container.agreementReader.get;
    container.agreementReader.get = async () => big;
    try {
      const response = await GET(new NextRequest(`http://localhost:3000/agreements/${AGR}/pdf`), { params: Promise.resolve({ agreementId: AGR }) });
      expect(response.status).toBe(200);
      const found = new Set(pdfPages(Buffer.from(await response.arrayBuffer())).join("\n").match(/^T\d+-\d+$/gm));
      expect(found.size).toBe(2000);
    } finally {
      container.agreementReader.get = original;
    }
  }, 120_000);

  test("C868: a version with no recorded scope answers 200 and says so", async () => {
    const response = await GET(new NextRequest(`http://localhost:3000/agreements/${AGR}/pdf`), { params: Promise.resolve({ agreementId: AGR }) });

    expect(response.status).toBe(200);
    expect(pdfPages(Buffer.from(await response.arrayBuffer())).join("\n")).toContain("The equipment covered by this version was not recorded");
  });
});
