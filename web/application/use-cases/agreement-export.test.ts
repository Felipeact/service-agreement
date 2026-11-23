import { describe, expect, test } from "vitest";
import type { AgreementListRow } from "@/application/ports";
import { agreementsCsv } from "./agreement-export";

const row = (patch: Partial<AgreementListRow> = {}): AgreementListRow => ({
  id: "a1",
  number: "AG-1001",
  status: "sent",
  stage: "sent",
  site: "Harbourview Towers",
  customer: 'Harbourview "Strata", Ltd',
  versionNo: 2,
  annualCents: 1234500,
  updatedAt: "2026-11-20T15:30:00Z",
  termEnd: "2027-11-30",
  ...patch,
});

describe("agreementsCsv", () => {
  test("a header row, then one quoted row per agreement with money in dollars", () => {
    const { csv } = agreementsCsv([row()], {}, "2026-11-22");
    const [header, line] = csv.split("\r\n");
    expect(header).toBe("Agreement,Version,Customer,Site,Status,Annual value,Term end,Last changed");
    expect(line).toBe('AG-1001,2,"Harbourview ""Strata"", Ltd",Harbourview Towers,Sent to customer,12345.00,2027-11-30,2026-11-20');
  });

  test("an unnumbered, unpriced agreement reads Draft with empty cells", () => {
    const line = agreementsCsv([row({ number: null, annualCents: null, termEnd: null })], {}, "2026-11-22").csv.split("\r\n")[1];
    expect(line.startsWith("Draft,2,")).toBe(true);
    expect(line).toContain(",,,2026-11-20");
  });

  test("the file name carries the filter and the day", () => {
    expect(agreementsCsv([], {}, "2026-11-22").filename).toBe("agreements-2026-11-22.csv");
    expect(agreementsCsv([], { status: "sent", expiring: true }, "2026-11-22").filename).toBe("agreements-sent-expiring-2026-11-22.csv");
  });
});
