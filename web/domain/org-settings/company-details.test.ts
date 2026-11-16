import { describe, expect, test } from "vitest";
import { companyDetailsReady } from "./company-details";

const AT = new Date("2026-11-16T12:00:00Z");
const REAL = { legalName: "Acme Heating Ltd.", address: "12 Main St, Surrey, BC V3T 1A1", phone: "604-555-2368" };

describe("companyDetailsReady", () => {
  test.each([
    ["legalName", { ...REAL, legalName: "" }],
    ["address", { ...REAL, address: "   " }],
    ["phone", { ...REAL, phone: null }],
  ] as const)("C6014: an empty %s is not ready and is named", (field, details) => {
    expect(companyDetailsReady({ ...details, confirmedAt: AT })).toEqual({ ready: false, problems: [field] });
  });

  test("C6014: all three empty names all three", () => {
    expect(companyDetailsReady({ legalName: "", address: "", phone: "", confirmedAt: AT })).toEqual({ ready: false, problems: ["legalName", "address", "phone"] });
  });

  test("C6015: real values that were never confirmed are not ready, problem unconfirmed", () => {
    expect(companyDetailsReady({ ...REAL, confirmedAt: null })).toEqual({ ready: false, problems: ["unconfirmed"] });
  });

  test.each([
    ["legalName", { ...REAL, legalName: "Kettle Ridge Mechanical Ltd." }],
    ["address", { ...REAL, address: "100 Sample Street, Burnaby, BC V5A 0A0" }],
    ["address", { ...REAL, address: "12 Main St, Burnaby, BC V5A 0A0" }],
    ["phone", { ...REAL, phone: "604-555-0100" }],
  ] as const)("C6016: a placeholder %s is not ready even when confirmed", (field, details) => {
    expect(companyDetailsReady({ ...details, confirmedAt: AT })).toEqual({ ready: false, problems: [field] });
  });

  test("C6016: real values that are confirmed are ready", () => {
    expect(companyDetailsReady({ ...REAL, confirmedAt: AT })).toEqual({ ready: true });
  });

  test("C6016: a real phone that only looks close is ready (604-555-2368, 555-1234)", () => {
    expect(companyDetailsReady({ ...REAL, phone: "555-1234", confirmedAt: AT })).toEqual({ ready: true });
  });
});
