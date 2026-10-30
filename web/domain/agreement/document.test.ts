import { describe, expect, test } from "vitest";
import type { OrgSettingsValue } from "../org-settings";
import { buildAgreementDocument, DRAFT_MARK, NEUTRAL_ACCENT, type DocumentSource } from "./document";

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

const SOURCE: DocumentSource = {
  number: "AG-1052",
  customer: { name: "Fernwood Dental" },
  site: { name: "Fernwood Dental, Main" },
  editable: false,
  shown: {
    versionNo: 1,
    lines: [
      { id: "l1", description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000, visitMonths: [3, 6, 9, 12], equipment: [{ name: "Rooftop unit" }] },
      { id: "l2", description: "Filter change", visitsPerYear: 2, costPerVisitCents: 94500, annualCents: 189000, visitMonths: [4, 10], equipment: [{ name: "Rooftop unit" }] },
    ],
    annualCents: 387000,
  },
  serviceScope: { source: "live", takenAt: null, types: [] },
  // The shown version is frozen, so these are the terms it was sent with (customer-portal door 3).
  terms: {
    repairDiscountPct: 10,
    cpiCapPct: 5,
    cancellationNoticeDays: 30,
    paymentDays: 30,
    governingProvince: "BC",
    taxNote: "GST extra",
  },
};

// The terms of a draft come from the org's settings (customer-portal AC 32); a frozen version prints its own.
const DRAFT_SOURCE: DocumentSource = { ...SOURCE, editable: true, terms: null };

describe("buildAgreementDocument", () => {
  test("C858: the header carries the tenant's name, address, phone and accent", () => {
    expect(buildAgreementDocument(SOURCE, SETTINGS).tenant).toEqual({
      name: "Kettle Ridge Mechanical Ltd.",
      address: "100 Sample Street, Burnaby, BC",
      phone: "604-555-0100",
      accent: "#1f6f8b",
    });
  });

  test("C858: a tenant with no address, phone or accent gets the neutral accent and null fields, never text", () => {
    const { tenant } = buildAgreementDocument(SOURCE, { ...SETTINGS, address: null, phone: null, accentColor: null });
    expect(tenant).toEqual({ name: "Kettle Ridge Mechanical Ltd.", address: null, phone: null, accent: NEUTRAL_ACCENT });
    expect(NEUTRAL_ACCENT).toMatch(/^#[0-9a-f]{6}$/);
    expect(NEUTRAL_ACCENT).not.toBe("#1f6f8b");
  });

  test("C864: all six terms print in order with their values", () => {
    expect(buildAgreementDocument(DRAFT_SOURCE, SETTINGS).terms).toEqual([
      { label: "Repair discount", value: "10%" },
      { label: "CPI cap", value: "5%" },
      { label: "Cancellation notice", value: "30 days" },
      { label: "Payment terms", value: "30 days" },
      { label: "Governing province", value: "BC" },
      { label: "Tax note", value: "GST extra" },
    ]);
  });

  test.each<[string, Partial<OrgSettingsValue>, string]>([
    ["cancellation notice", { cancellationNoticeDays: null }, "Cancellation notice"],
    ["payment terms", { paymentDays: null }, "Payment terms"],
    ["governing province", { governingProvince: null }, "Governing province"],
    ["tax note", { taxNote: null }, "Tax note"],
  ])("C864: with %s null only that term is absent", (_name, over, label) => {
    const labels = buildAgreementDocument(DRAFT_SOURCE, { ...SETTINGS, ...over }).terms.map((term) => term.label);
    expect(labels).not.toContain(label);
    expect(labels).toHaveLength(5);
  });

  test("C864: with the four nullable terms null, the two numeric terms still print", () => {
    const bare = { ...SETTINGS, cancellationNoticeDays: null, paymentDays: null, governingProvince: null, taxNote: null };
    expect(buildAgreementDocument(DRAFT_SOURCE, bare).terms.map((term) => term.label)).toEqual(["Repair discount", "CPI cap"]);
  });

  test("C864: one day is singular and a fractional percent keeps its decimals", () => {
    const { terms } = buildAgreementDocument(DRAFT_SOURCE, { ...SETTINGS, cancellationNoticeDays: 1, repairDiscountPct: 12.5 });
    expect(terms[0].value).toBe("12.5%");
    expect(terms[2].value).toBe("1 day");
  });

  test("C859: number, version, customer and site come from the version shown", () => {
    const doc = buildAgreementDocument({ ...SOURCE, shown: { ...SOURCE.shown, versionNo: 2 } }, SETTINGS);
    expect([doc.number, doc.versionNo, doc.customerName, doc.siteName]).toEqual(["AG-1052", 2, "Fernwood Dental", "Fernwood Dental, Main"]);
  });

  test("C860: lines carry their cents and the total is the version's annualCents", () => {
    const doc = buildAgreementDocument(DRAFT_SOURCE, SETTINGS);
    expect(doc.lines.map((line) => line.annualCents)).toEqual([180000, 189000]);
    expect(doc.lines[0]).toEqual({ description: "Quarterly visit", visitsPerYear: 4, costPerVisitCents: 45000, annualCents: 180000 });
    expect(doc.totalCents).toBe(387000);
    expect(buildAgreementDocument({ ...SOURCE, shown: { ...SOURCE.shown, annualCents: 1 } }, SETTINGS).totalCents).toBe(1);
  });

  test("C866: only an editable (current draft) version is marked", () => {
    expect(buildAgreementDocument({ ...SOURCE, editable: true }, SETTINGS).mark).toBe(DRAFT_MARK);
    expect(buildAgreementDocument({ ...SOURCE, editable: false }, SETTINGS).mark).toBeNull();
    expect(DRAFT_MARK).toBe("DRAFT - not yet sent to the customer");
  });

  test("C867: a frozen scope carries when it was taken, a live scope does not", () => {
    const takenAt = new Date("2026-10-20T15:00:00Z");
    expect(buildAgreementDocument({ ...SOURCE, serviceScope: { source: "frozen", takenAt, types: [] } }, SETTINGS).scope).toEqual({
      kind: "listed",
      recordedOn: takenAt,
      types: [],
    });
    expect(buildAgreementDocument(DRAFT_SOURCE, SETTINGS).scope).toEqual({ kind: "listed", recordedOn: null, types: [] });
  });

  test("C868: a scope nobody recorded stays not recorded", () => {
    expect(buildAgreementDocument({ ...SOURCE, serviceScope: { source: "not_recorded" } }, SETTINGS).scope).toEqual({ kind: "not_recorded" });
  });
});

describe("which terms the document prints", () => {
  const FROZEN_TERMS = {
    repairDiscountPct: 10,
    cpiCapPct: 5,
    cancellationNoticeDays: 30,
    paymentDays: 30,
    governingProvince: "BC",
    taxNote: "GST extra",
  };
  const LABELS = ["Repair discount", "CPI cap", "Cancellation notice", "Payment terms", "Governing province", "Tax note"];

  test("C934: a frozen version prints its frozen terms, in the order and with the labels agreement-pdf set", () => {
    const { terms } = buildAgreementDocument({ ...SOURCE, editable: false, terms: FROZEN_TERMS }, SETTINGS);
    expect(terms.map((term) => term.label)).toEqual(LABELS);
    expect(terms.map((term) => term.value)).toEqual(["10%", "5%", "30 days", "30 days", "BC", "GST extra"]);
  });

  test("C934: a frozen version keeps its terms after the settings differ", () => {
    const changed = { ...SETTINGS, repairDiscountPct: 15, cpiCapPct: 7, paymentDays: 45, taxNote: "Changed" };
    const { terms } = buildAgreementDocument({ ...SOURCE, editable: false, terms: FROZEN_TERMS }, changed);
    expect(terms.map((term) => term.value)).toEqual(["10%", "5%", "30 days", "30 days", "BC", "GST extra"]);
  });

  test("C934: the current version of a draft prints the settings' terms, not a stored copy", () => {
    const changed = { ...SETTINGS, repairDiscountPct: 15 };
    const { terms } = buildAgreementDocument({ ...SOURCE, editable: true, terms: null }, changed);
    expect(terms[0]).toEqual({ label: "Repair discount", value: "15%" });
    expect(terms).toHaveLength(6);
  });

  test("C934: a past version of a draft is frozen and prints its own terms", () => {
    const { terms } = buildAgreementDocument({ ...SOURCE, editable: false, terms: { ...FROZEN_TERMS, repairDiscountPct: 7 } }, { ...SETTINGS, repairDiscountPct: 15 });
    expect(terms[0]).toEqual({ label: "Repair discount", value: "7%" });
  });

  test("C935: a frozen version with no terms prints none and does not fall back to the settings", () => {
    const { terms } = buildAgreementDocument({ ...SOURCE, editable: false, terms: null }, { ...SETTINGS, repairDiscountPct: 99 });
    expect(terms).toEqual([]);
    expect(JSON.stringify(buildAgreementDocument({ ...SOURCE, editable: false, terms: null }, { ...SETTINGS, repairDiscountPct: 99 }))).not.toContain("99%");
  });
});
