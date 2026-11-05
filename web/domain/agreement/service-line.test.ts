import { describe, expect, test } from "vitest";
import type { ContractStatus } from "../contract";
import { statusLabel, validateServiceLine, type AgreementStatus } from "./index";

const TYPE = "55555555-5555-4555-8555-555555555555";
const valid = { description: "Preventive maintenance visit", visitMonths: ["3", "6", "9", "12"], costPerVisit: "892.50", assetTypeIds: [TYPE] };

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
    expect(result).toEqual({ ok: true, value: { description: expected, visitMonths: [3, 6, 9, 12], costPerVisitCents: 89250, assetTypeIds: [TYPE] } });
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
