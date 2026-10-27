import { describe, expect, test } from "vitest";
import type { ContractStatus } from "../contract";
import { statusLabel, validateServiceLine, type AgreementStatus } from "./index";

const valid = { description: "Preventive maintenance visit", visitsPerYear: "4", costPerVisit: "892.50" };

describe("validateServiceLine", () => {
  test.each<[string, string]>([
    ["empty", ""],
    ["blank", "   "],
    ["201 characters", "d".repeat(201)],
  ])("C720: a description that is %s is refused with a description message", (_, description) => {
    const result = validateServiceLine({ ...valid, description });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.description).toEqual(expect.any(String));
      expect(Object.keys(result.errors)).toEqual(["description"]);
    }
  });

  test.each<[string, string, string]>([
    ["1 character", " x ", "x"],
    ["200 characters after trimming", `  ${"d".repeat(200)}  `, "d".repeat(200)],
  ])("C720: a description of %s is accepted and returned trimmed", (_, description, expected) => {
    const result = validateServiceLine({ ...valid, description });
    expect(result).toEqual({ ok: true, value: { description: expected, visitsPerYear: 4, costPerVisitCents: 89250 } });
  });

  test.each(["", "0", "366", "4.5", "abc"])("C720: visits %j are refused with a visits message", (visitsPerYear) => {
    const result = validateServiceLine({ ...valid, visitsPerYear });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(["visitsPerYear"]);
  });

  test.each<[string, number]>([
    ["1", 1],
    ["365", 365],
  ])("C720: visits %j give %i", (visitsPerYear, expected) => {
    const result = validateServiceLine({ ...valid, visitsPerYear });
    expect(result.ok && result.value.visitsPerYear).toBe(expected);
  });

  test.each(["", "-5", "abc", "1.234", "1,23", "1,000,000"])("C720: cost %j is refused with a cost message", (costPerVisit) => {
    const result = validateServiceLine({ ...valid, costPerVisit });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors)).toEqual(["costPerVisit"]);
  });

  test.each<[string, number]>([
    ["0", 0],
    ["892.50", 89250],
    ["$1,234.5", 123450],
    ["999,999.99", 99999999],
  ])("C720: cost %j gives %i cents", (costPerVisit, expected) => {
    const result = validateServiceLine({ ...valid, costPerVisit });
    expect(result.ok && result.value.costPerVisitCents).toBe(expected);
  });

  test("C720: an input bad in all three fields returns all three messages", () => {
    const result = validateServiceLine({ description: " ", visitsPerYear: "0", costPerVisit: "abc" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(["costPerVisit", "description", "visitsPerYear"]);
      for (const message of Object.values(result.errors)) expect(message).toEqual(expect.any(String));
    }
  });
});

describe("statusLabel", () => {
  test.each<[AgreementStatus, ContractStatus | undefined, string]>([
    ["draft", undefined, "In progress"],
    ["changes_requested", undefined, "In progress"],
    ["sent", undefined, "Sent to customer"],
    ["accepted", undefined, "Accepted, awaiting signature"],
    ["accepted", "completed", "Completed"],
    ["refused", undefined, "Refused"],
    ["expired", undefined, "Refused"],
    ["withdrawn", undefined, "Withdrawn"],
    ["accepted", "voided", "Contract voided"],
  ])("C734: %s with contract %s is labelled %j", (status, contract, label) => {
    expect(statusLabel(status, contract)).toBe(label);
  });
});
