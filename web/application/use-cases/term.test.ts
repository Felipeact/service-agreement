import { describe, expect, test } from "vitest";
import { portalView } from "@/application/portal-view.testing";
import type { AgreementDetail } from "@/application/ports";
import { buildAgreementDocument } from "@/domain/agreement";
import type { OrgSettingsValue } from "@/domain/org-settings";
import { portalDocument } from "./portal";

const FROZEN = {
  repairDiscountPct: 10,
  cpiCapPct: 3,
  cancellationNoticeDays: 30,
  paymentDays: 30,
  governingProvince: "BC",
  taxNote: null,
  renewalNoticeDays: 30,
  cpiRenegotiationThresholdPct: 5,
};

describe("the customer PDF's term", () => {
  test("C1159: portalDocument gives the same term line and Renewal row as buildAgreementDocument over the equivalent detail", () => {
    const view = portalView({ terms: FROZEN, term: { start: "2027-01-01", months: 12, end: "2027-12-31" }, lines: [], annualCents: 0, scope: null });
    const detail: AgreementDetail = {
      id: "g1",
      number: view.agreement.number,
      status: "sent",
      stage: "sent",
      site: { id: "s1", name: view.site.name },
      customer: { id: "c1", name: view.customer.name },
      versions: [{ versionNo: 1, createdAt: new Date("2026-10-20T15:00:00Z") }],
      shown: { versionNo: 1, current: true, lines: [], annualCents: 0 },
      editable: false,
      equipmentChoices: [],
      serviceScope: { source: "not_recorded" },
      terms: FROZEN,
      term: view.term,
      portalLink: null,
      linkEmail: null,
      renews: null,
      renewedBy: null,
    };
    // The staff side's settings differ, and a frozen version must ignore them.
    const settings = { legalName: "Kettle Ridge Mechanical Ltd.", address: null, phone: null, accentColor: null, renewalNoticeDays: 90, cpiRenegotiationThresholdPct: 9 } as OrgSettingsValue;
    const staff = buildAgreementDocument(detail, settings);
    const customer = portalDocument(view);
    expect(customer?.term).toBe("Term: Jan 1, 2027 – Dec 31, 2027 (12 months)");
    expect(customer?.term).toBe(staff.term);
    const renewal = (terms: { label: string; value: string }[] | undefined) => terms?.find((term) => term.label === "Renewal");
    expect(renewal(customer?.terms)).toEqual(renewal(staff.terms));
    expect(renewal(customer?.terms)?.value).toContain("If CPI is 5% or more");
  });
});
