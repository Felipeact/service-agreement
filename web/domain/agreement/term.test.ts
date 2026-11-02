import { describe, expect, test } from "vitest";
import type { OrgSettingsValue } from "../org-settings";
import { buildAgreementDocument, termsOf, type DocumentSource } from "./document";
import { parseTerms, type AgreementTerms } from "./index";
import { formatTermDate, termLine, validateAgreementTerm } from "./term";

const MONTHS_ERROR = "Term must be a whole number of months from 1 to 60";
const START_ERROR = "Enter a start date between 2000 and 2099";

describe("validateAgreementTerm", () => {
  test.each([
    ["2027-01-01", "12"],
    ["2027-01-01", "1"],
    ["2027-01-01", "60"],
    ["2000-01-01", "12"],
    ["2099-12-31", "12"],
  ])("C1141: start %s with %s months is accepted", (start, months) => {
    expect(validateAgreementTerm({ start, months })).toEqual({ ok: true, value: { start, months: Number(months) } });
  });

  test.each(["", "0", "61", "6.5"])("C1141: months %j is refused", (months) => {
    expect(validateAgreementTerm({ start: "2027-01-01", months })).toEqual({ ok: false, errors: { months: MONTHS_ERROR } });
  });

  test.each(["", "1999-12-31", "2100-01-01", "2027-02-30", "01/01/2027"])("C1141: start %j is refused", (start) => {
    expect(validateAgreementTerm({ start, months: "12" })).toEqual({ ok: false, errors: { start: START_ERROR } });
  });
});

describe("the date label", () => {
  test("C1148: a calendar date reads the same in any time zone", () => {
    const before = process.env.TZ;
    try {
      for (const zone of ["America/Vancouver", "Asia/Tokyo"]) {
        process.env.TZ = zone;
        expect(formatTermDate("2027-01-01")).toBe("Jan 1, 2027");
        expect(formatTermDate("2027-12-31")).toBe("Dec 31, 2027");
      }
    } finally {
      process.env.TZ = before;
    }
  });
});

const TERMS: AgreementTerms = {
  repairDiscountPct: 10,
  cpiCapPct: 3,
  cancellationNoticeDays: 30,
  paymentDays: 30,
  governingProvince: "BC",
  taxNote: null,
  renewalNoticeDays: null,
  cpiRenegotiationThresholdPct: null,
};

describe("parseTerms with the renewal keys", () => {
  const six = { repairDiscountPct: 10, cpiCapPct: 3, cancellationNoticeDays: 30, paymentDays: 30, governingProvince: "BC", taxNote: null };

  test("C1152: a terms object without the renewal keys gives them as null", () => {
    expect(parseTerms({ terms: six })).toEqual({ ...six, renewalNoticeDays: null, cpiRenegotiationThresholdPct: null });
  });

  test("C1152: the renewal keys are read when present", () => {
    expect(parseTerms({ terms: { ...six, renewalNoticeDays: 30, cpiRenegotiationThresholdPct: 5 } })).toEqual({
      ...six,
      renewalNoticeDays: 30,
      cpiRenegotiationThresholdPct: 5,
    });
  });

  test.each([-1, 366, "30", 1.5])("C1152: renewalNoticeDays %j is not a terms object", (value) => {
    expect(parseTerms({ terms: { ...six, renewalNoticeDays: value, cpiRenegotiationThresholdPct: 5 } })).toBeNull();
  });

  test.each([-1, 101, "5"])("C1152: cpiRenegotiationThresholdPct %j is not a terms object", (value) => {
    expect(parseTerms({ terms: { ...six, renewalNoticeDays: 30, cpiRenegotiationThresholdPct: value } })).toBeNull();
  });
});

const SETTINGS: OrgSettingsValue = {
  legalName: "Acme Ltd.",
  address: null,
  phone: null,
  accentColor: null,
  ...TERMS,
  defaultTermMonths: 12,
  renewalNoticeDays: 45,
  cpiRenegotiationThresholdPct: 7,
  renewalCpiPct: null,
  renewalCpiAsOf: null,
  proposalValidityDays: 30,
};

const source = (over: Partial<DocumentSource>): DocumentSource => ({
  number: "AG-1052",
  customer: { name: "Fernwood Dental" },
  site: { name: "Main" },
  editable: false,
  shown: { versionNo: 1, lines: [], annualCents: 0 },
  serviceScope: { source: "not_recorded" },
  terms: TERMS,
  term: { start: "2027-01-01", months: 12, end: "2027-12-31" },
  ...over,
});

describe("the term line", () => {
  test("C1153: a version with a start prints its dates and months", () => {
    expect(buildAgreementDocument(source({}), SETTINGS).term).toBe("Term: Jan 1, 2027 – Dec 31, 2027 (12 months)");
  });

  test("C1153: the current draft with no start says it is to be set", () => {
    const draft = source({ editable: true, terms: null, term: { start: null, months: 12, end: null } });
    expect(buildAgreementDocument(draft, SETTINGS).term).toBe("Term: start date to be set (12 months)");
  });

  test("C1153: a frozen version with no start was not recorded", () => {
    expect(buildAgreementDocument(source({ term: { start: null, months: 12, end: null } }), SETTINGS).term).toBe("Term: not recorded for this version");
    expect(termLine({ start: null, months: 12, end: null }, false)).toBe("Term: not recorded for this version");
  });
});

const RENEWAL_30_5 =
  "Renews automatically for another 12 months with the CPI increase, capped at 3%. If CPI is 5% or more, the renewal is renegotiated. Notice is given 30 days before the end date.";

describe("the renewal row", () => {
  test("C1154: with both renewal values the terms end with a Renewal row", () => {
    expect(termsOf({ ...TERMS, renewalNoticeDays: 30, cpiRenegotiationThresholdPct: 5 }, 12).at(-1)).toEqual({ label: "Renewal", value: RENEWAL_30_5 });
  });

  test.each([
    [{ renewalNoticeDays: null, cpiRenegotiationThresholdPct: 5 }],
    [{ renewalNoticeDays: 30, cpiRenegotiationThresholdPct: null }],
  ])("C1154: with a renewal value null there is no Renewal row (%j)", (over) => {
    expect(termsOf({ ...TERMS, ...over }, 12).map((term) => term.label)).not.toContain("Renewal");
  });

  test("C1154: the current draft uses the settings, a frozen version its own values", () => {
    const draft = buildAgreementDocument(source({ editable: true, terms: null }), SETTINGS).terms.at(-1);
    expect(draft?.value).toBe(
      "Renews automatically for another 12 months with the CPI increase, capped at 3%. If CPI is 7% or more, the renewal is renegotiated. Notice is given 45 days before the end date.",
    );
    const frozen = buildAgreementDocument(source({ terms: { ...TERMS, renewalNoticeDays: 30, cpiRenegotiationThresholdPct: 5 } }), SETTINGS).terms.at(-1);
    expect(frozen?.value).toBe(RENEWAL_30_5);
    const old = buildAgreementDocument(source({}), SETTINGS).terms.map((term) => term.label);
    expect(old).not.toContain("Renewal");
  });
});
