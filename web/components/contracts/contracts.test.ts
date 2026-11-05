import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { AgreementDetail, ContractDetail, MemberRole } from "@/application/ports";
import type { ContractStatus } from "@/domain/contract";
import { ContractView } from "./contract-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/contracts/con-1" }));

const PARTIES: NonNullable<ContractDetail["parties"]> = {
  contractor: { legalName: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street, Burnaby, BC", phone: "604-555-0100" },
  customer: { name: "Fernwood Dental" },
  site: { name: "Fernwood Dental, Main", address: "12 Oak Ave" },
  signer: { name: "Pat Lee", email: "pat@example.com" },
};

const contract = (over: Partial<ContractDetail> = {}): ContractDetail => ({
  id: "con-1",
  status: "pending_signature",
  agreementId: "agr-1",
  versionNo: 1,
  number: "AG-1052",
  createdAt: new Date("2026-11-05T18:00:00Z"),
  parties: PARTIES,
  ...over,
});

const agreement = (over: Partial<AgreementDetail> = {}): AgreementDetail => ({
  id: "agr-1",
  number: "AG-1052",
  status: "accepted",
  stage: "accepted",
  site: { id: "site-1", name: "Fernwood Dental, Main" },
  customer: { id: "cust-1", name: "Fernwood Dental" },
  versions: [{ versionNo: 1, createdAt: new Date("2026-10-20T18:00:00Z"), reason: null, author: null, events: [] }],
  sentVersion: 1,
  acceptedVersion: 1,
  compare: null,
  shown: {
    versionNo: 1,
    current: true,
    lines: [
      { id: "l1", position: 0, description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000, visitMonths: [3, 6, 9, 12], equipment: [{ id: "t-rtu", code: "RTU", name: "Rooftop unit" }] },
    ],
    annualCents: 180000,
  },
  editable: false,
  equipmentChoices: [],
  serviceScope: { source: "frozen", takenAt: new Date("2026-10-20T15:00:00Z"), types: [] },
  terms: { repairDiscountPct: 10, cpiCapPct: 5, cancellationNoticeDays: 30, paymentDays: null, governingProvince: "BC", taxNote: "GST extra", renewalNoticeDays: null, cpiRenegotiationThresholdPct: null },
  term: { start: "2027-01-01", months: 12, end: "2027-12-31" },
  validUntil: null,
  portalLink: null,
  linkEmail: null,
  renews: null,
  renewedBy: null,
  ...over,
});

const view = (c: ContractDetail = contract(), a: AgreementDetail = agreement()) => renderToStaticMarkup(createElement(ContractView, { contract: c, agreement: a }));
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("the contract view", () => {
  test("C1630: heading, signer, links, term, total, agreement link and the PDF download", () => {
    const html = view();
    const out = text(html);
    expect(html).toContain(">Contract · AG-1052</h1>");
    expect(out).toContain("Pat Lee");
    expect(out).toContain("pat@example.com");
    expect(html).toMatch(/<a[^>]*href="\/customers\/cust-1"[^>]*>Fernwood Dental<\/a>/);
    expect(html).toMatch(/<a[^>]*href="\/sites\/site-1"[^>]*>Fernwood Dental, Main<\/a>/);
    expect(out).toContain("Term: Jan 1, 2027 – Dec 31, 2027 · 12 months");
    expect(out).toContain("Total per year $1,800.00");
    expect(out).toContain("Before tax");
    expect(html).toMatch(/<a[^>]*href="\/agreements\/agr-1"[^>]*>[^<]*<\/a>/);
    expect(html).toMatch(/<a[^>]*href="\/contracts\/con-1\/pdf"[^>]*>Download PDF<\/a>/);
  });

  test("C1630: the parties are shown as frozen, not as the agreement's names", () => {
    const out = text(view(contract(), agreement({ customer: { id: "cust-1", name: "Renamed Customer" }, site: { id: "site-1", name: "Renamed Site" } })));
    expect(out).toContain("Kettle Ridge Mechanical Ltd.");
    expect(out).toContain("100 Sample Street, Burnaby, BC");
    expect(out).toContain("12 Oak Ave");
    expect(out).toContain("Fernwood Dental, Main");
    expect(out).not.toContain("Renamed");
  });

  test.each<[ContractStatus, string, "attention" | "neutral"]>([
    ["pending_signature", "Pending signature", "attention"],
    ["client_signed", "Client signed", "attention"],
    ["completed", "Completed", "neutral"],
    ["declined", "Declined", "neutral"],
    ["voided", "Voided", "neutral"],
  ])("C1631: %s reads %s on a pill with tone %s", (status, label, tone) => {
    const html = view(contract({ status }));
    expect(html).toMatch(new RegExp(`<span[^>]*data-tone="${tone}"[^>]*>${label}</span>`));
  });

  test("C1632: the lines, the visit schedule and the terms that are set", () => {
    const html = view();
    const out = text(html);
    expect(out).toContain("Quarterly visit");
    expect(out).toContain("Mar, Jun, Sep, Dec");
    expect(out).toContain("$1,800.00");
    expect(html).toContain('aria-label="Visit schedule"');
    expect(out).toContain("Mar");
    for (const set of ["Repair discount 10%", "CPI cap 5%", "Cancellation notice 30 days", "Governing province BC", "Tax note GST extra"]) expect(out, set).toContain(set);
  });

  test("C1632: a term that is null is not listed", () => {
    const out = text(view());
    expect(out).not.toContain("Payment terms");
    expect(out).not.toContain("Renewal");
  });

  // The page takes no role: it has no write control to hide, so every role reads the same markup.
  test.each<MemberRole>(["owner", "admin", "estimator", "viewer"])("C1633: a %s sees a page with no form and no button", () => {
    const html = view(contract(), agreement());
    expect(html).toContain(">Contract · AG-1052</h1>");
    expect(html).not.toContain("<form");
    expect(html).not.toContain("<button");
  });

  test("C1634: with no recorded parties it says so, names no signer and offers no PDF", () => {
    const html = view(contract({ parties: null }));
    const out = text(html);
    expect(out).toContain("Parties not recorded for this contract.");
    expect(out).not.toContain("Pat Lee");
    expect(out).not.toContain("pat@example.com");
    expect(html).not.toContain("Download PDF");
    expect(html).toContain(">Contract · AG-1052</h1>");
    expect(html).toContain("Pending signature");
  });
});
