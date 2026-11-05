import { describe, expect, test } from "vitest";
import { matchesStatusFilter, parseAgreementFilter } from "./list-filter";
import type { AgreementStatus } from "./index";
import type { ContractStatus } from "../contract";

const SITE = "00000000-0000-4000-8000-000000000001";

describe("parseAgreementFilter", () => {
  test.each(["in_progress", "sent", "accepted", "completed", "refused", "expired", "withdrawn"])("C1347: status %s is kept", (status) => {
    expect(parseAgreementFilter({ status })).toEqual({ status });
  });

  test("C1347: an unknown status, a non-uuid site and an expiring other than 1 are dropped", () => {
    expect(parseAgreementFilter({ status: "draft", site: "nope", expiring: "true" })).toEqual({});
    expect(parseAgreementFilter({ status: "", site: "", expiring: "0" })).toEqual({});
    expect(parseAgreementFilter({})).toEqual({});
  });

  test("C1347: a uuid site and expiring=1 are kept", () => {
    expect(parseAgreementFilter({ site: SITE, expiring: "1" })).toEqual({ siteId: SITE, expiring: true });
  });

  test("C1347: an array-valued parameter keeps nothing", () => {
    expect(parseAgreementFilter({ status: ["sent", "accepted"], site: [SITE], expiring: ["1"] })).toEqual({});
  });
});

type Row = [string, AgreementStatus, ContractStatus | null];
const ROWS: Row[] = [
  ["draft", "draft", null],
  ["changes_requested", "changes_requested", null],
  ["sent", "sent", null],
  ["accepted no contract", "accepted", null],
  ["accepted completed", "accepted", "completed"],
  ["refused", "refused", null],
  ["expired", "expired", null],
  ["withdrawn", "withdrawn", null],
];

describe("matchesStatusFilter", () => {
  test.each([
    ["in_progress", ["draft", "changes_requested"]],
    ["sent", ["sent"]],
    ["accepted", ["accepted no contract"]],
    ["completed", ["accepted completed"]],
    ["refused", ["refused", "expired"]],
    ["expired", ["expired"]],
    ["withdrawn", ["withdrawn"]],
  ] as const)("C1348: %s keeps %j", (value, kept) => {
    const names = ROWS.filter(([, status, contract]) => matchesStatusFilter(value, status, contract)).map(([name]) => name);
    expect(names).toEqual(kept);
  });
});
