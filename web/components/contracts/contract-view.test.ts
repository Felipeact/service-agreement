import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test, vi } from "vitest";
import type { AgreementDetail, ContractDetail } from "@/application/ports";
import { ContractView } from "./contract-view";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/contracts/con-1" }));

const contract = (over: Partial<ContractDetail> = {}): ContractDetail => ({
  id: "con-1",
  status: "pending_signature",
  agreementId: "agr-1",
  versionNo: 1,
  number: "AG-1052",
  createdAt: new Date("2026-11-05T18:00:00Z"),
  parties: {
    contractor: { legalName: "Kettle Ridge Mechanical Ltd.", address: "100 Sample Street, Burnaby, BC", phone: "604-555-0100" },
    customer: { name: "Fernwood Dental" },
    site: { name: "Fernwood Dental, Main", address: "12 Oak Ave" },
    signer: { name: "Pat Lee", email: "pat@customer.ca" },
  },
  ...over,
});

const agreement = {
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
  shown: { versionNo: 1, current: true, lines: [], annualCents: 0 },
  editable: false,
  equipmentChoices: [],
  serviceScope: { source: "frozen", takenAt: new Date("2026-10-20T15:00:00Z"), types: [] },
  terms: null,
  term: { start: "2027-01-01", months: 12, end: "2027-12-31" },
  validUntil: null,
  portalLink: null,
  linkEmail: null,
  renews: null,
  renewedBy: null,
} as unknown as AgreementDetail;

const view = (c: ContractDetail) => renderToStaticMarkup(createElement(ContractView, { contract: c, agreement }));

describe("the contract page, the signing-link email line", () => {
  test("C1797: a sent email reads 'Signing link emailed to <address> on <day>'", () => {
    const html = view(contract({ signingLinkEmail: { status: "sent", to: "pat@customer.ca", sentAt: new Date("2026-11-08T18:00:00Z") } }));
    expect(html).toContain("data-signing-link-email");
    expect(html).toContain("Signing link emailed to pat@customer.ca on Nov 8, 2026");
  });

  test.each([
    ["failed", "the email service did not accept it"],
    ["no_recipient", "the site has no contact email"],
    ["not_signable", "the contract can no longer be signed"],
  ] as const)("C1797: not sent because %s reads 'The signing link email did not go out: ...'", (reason, words) => {
    const html = view(contract({ signingLinkEmail: { status: "not_sent", reason } }));
    expect(html).toContain(`The signing link email did not go out: ${words}`);
  });

  test.each([
    ["never sent", null],
    ["not yet decided", { status: "pending" as const }],
    ["an older fixture without the field", undefined],
  ])("C1797: %s shows no line", (_label, signingLinkEmail) => {
    expect(view(contract({ signingLinkEmail }))).not.toContain("data-signing-link-email");
  });
});
