import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { AgreementDetail, ContractDetail, ContractRenderer, CurrentMember, MemberRole } from "@/application/ports";
import type { OrgSettingsValue } from "@/domain/org-settings";

const CON = "66666666-6666-4666-8666-666666666666";
const AGR = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";

const SETTINGS: OrgSettingsValue = {
  legalName: "Changed Later Ltd.",
  address: null,
  phone: null,
  accentColor: "#1f6f8b",
  repairDiscountPct: 99,
  cpiCapPct: 99,
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

const PARTIES: NonNullable<ContractDetail["parties"]> = {
  contractor: { legalName: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street", phone: "604-555-0100" },
  customer: { name: "Fernwood Dental" },
  site: { name: "Fernwood Dental, Main", address: "12 Oak Ave" },
  signer: { name: "Pat Lee", email: "pat@example.com" },
};

const contract = (over: Partial<ContractDetail> = {}): ContractDetail => ({
  id: CON,
  status: "pending_signature",
  agreementId: AGR,
  versionNo: 1,
  number: "AG-1052",
  createdAt: new Date("2026-11-05T18:00:00Z"),
  parties: PARTIES,
  ...over,
});

const agreement = (): AgreementDetail =>
  ({
    id: AGR,
    number: "AG-1052",
    status: "accepted",
    customer: { id: "c1", name: "Other" },
    site: { id: "s1", name: "Other" },
    editable: false,
    shown: { versionNo: 1, current: true, lines: [], annualCents: 0 },
    serviceScope: { source: "not_recorded" },
    terms: { repairDiscountPct: 10, cpiCapPct: 5, cancellationNoticeDays: 30, paymentDays: 30, governingProvince: "BC", taxNote: "GST extra", renewalNoticeDays: null, cpiRenegotiationThresholdPct: null },
    term: { start: "2027-01-01", months: 12, end: "2027-12-31" },
    validUntil: null,
  }) as unknown as AgreementDetail;

const member = (role: MemberRole): CurrentMember => ({ status: "member", userId: "u1", email: "u@example.com", orgId: ORG, orgName: "Kettle Ridge", role });

const currentMember = vi.fn<() => Promise<CurrentMember>>();
const contractGet = vi.fn<(id: string) => Promise<ContractDetail | null>>();
const agreementGet = vi.fn<(id: string, versionNo?: number) => Promise<AgreementDetail | null>>();
const getOrgSettings = vi.fn<(orgId: string) => Promise<OrgSettingsValue | null>>();
const renderContract = vi.fn<ContractRenderer["renderContract"]>();
const container = { currentMember, contractReader: { get: contractGet }, agreementReader: { get: agreementGet }, getOrgSettings, contractRenderer: { renderContract } };

vi.mock("@/composition", () => ({ getContainer: async () => container }));

const { GET, maxDuration } = await import("./route");

const call = (id = CON) => GET(new NextRequest(`http://localhost:3000/contracts/${id}/pdf`), { params: Promise.resolve({ contractId: id }) });
const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);

beforeEach(() => {
  vi.restoreAllMocks();
  currentMember.mockReset().mockResolvedValue(member("estimator"));
  contractGet.mockReset().mockResolvedValue(contract());
  agreementGet.mockReset().mockResolvedValue(agreement());
  getOrgSettings.mockReset().mockResolvedValue(SETTINGS);
  renderContract.mockReset().mockResolvedValue(bytes);
});

describe("GET /contracts/[contractId]/pdf", () => {
  test.each<MemberRole>(["owner", "admin", "estimator", "viewer"])("C1636: a %s gets 200 with the PDF headers and the renderer's bytes untouched", async (role) => {
    currentMember.mockResolvedValue(member(role));
    const response = await call();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/pdf");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(response.headers.get("Content-Disposition")).toBe('attachment; filename="AG-1052-contract.pdf"');
    expect(Buffer.from(await response.arrayBuffer()).equals(Buffer.from(bytes))).toBe(true);
  });

  test("C1636: it reads the agreement at the contract's version and builds the document from the parties and the settings' colour", async () => {
    contractGet.mockResolvedValue(contract({ versionNo: 3 }));
    await call();
    expect(agreementGet).toHaveBeenCalledWith(AGR, 3);
    expect(getOrgSettings).toHaveBeenCalledWith(ORG);
    const document = renderContract.mock.calls[0][0];
    expect(document.contractor).toEqual({ name: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street", phone: "604-555-0100", accent: "#1f6f8b" });
    expect(document.customerName).toBe("Fernwood Dental");
    expect(document.clauses).toContain("Repair work is discounted by 10%.");
  });

  test("C1636: the route allows at least twice the measured render time of a long document", () => {
    expect(maxDuration).toBeGreaterThanOrEqual(44);
  });

  test.each<[string, string, () => void]>([
    ["a malformed id", "not-a-uuid", () => {}],
    ["a contract the reader does not return", CON, () => contractGet.mockResolvedValue(null)],
    ["a contract with no recorded parties", CON, () => contractGet.mockResolvedValue(contract({ parties: null }))],
    ["an agreement the reader does not return", CON, () => agreementGet.mockResolvedValue(null)],
  ])("C1637: %s answers an empty 404 and renders nothing", async (_name, id, arrange) => {
    arrange();
    const response = await call(id);

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
    expect(renderContract).not.toHaveBeenCalled();
  });

  test("C1637: a malformed id reads nothing at all", async () => {
    await call("not-a-uuid");
    expect(contractGet).not.toHaveBeenCalled();
    expect(getOrgSettings).not.toHaveBeenCalled();
  });

  test("C1637: signed out is sent to /login and nothing is read or rendered", async () => {
    currentMember.mockResolvedValue({ status: "signed_out" });
    const response = await call();

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location") as string).pathname).toBe("/login");
    expect(contractGet).not.toHaveBeenCalled();
    expect(renderContract).not.toHaveBeenCalled();
  });

  test.each<[string, () => void]>([
    ["the renderer rejects", () => renderContract.mockRejectedValue(new Error("layout failed"))],
    ["the settings read rejects", () => getOrgSettings.mockRejectedValue(new Error("db down"))],
    ["the org has no settings row", () => getOrgSettings.mockResolvedValue(null)],
  ])("C1638: when %s the route answers an empty 503, logs once and sends no PDF", async (_name, arrange) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    arrange();
    const response = await call();

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("");
    expect(response.headers.get("Content-Type")).not.toBe("application/pdf");
    expect(log).toHaveBeenCalledTimes(1);
  });

  test("C1638: a reader that rejects is not caught by the route", async () => {
    contractGet.mockRejectedValue(new Error("db down"));
    await expect(call()).rejects.toThrow("db down");
  });
});
