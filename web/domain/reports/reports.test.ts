import { describe, expect, test } from "vitest";
import { dropOff, parseReportRange, reportAccess, signLabel, toCsv, winRate } from ".";

const TODAY = "2027-06-15";

describe("report range (reporting AC 18)", () => {
  test("C5721: no params is the 12 months ending today, with no notice", () => {
    expect(parseReportRange({}, TODAY)).toEqual({ range: { from: "2026-06-16", to: "2027-06-15" }, notice: null });
  });

  test("C5721: valid dates are kept", () => {
    expect(parseReportRange({ from: "2027-01-01", to: "2027-03-31" }, TODAY)).toEqual({ range: { from: "2027-01-01", to: "2027-03-31" }, notice: null });
  });

  test("C5721: from after to falls back to the default with a notice", () => {
    const result = parseReportRange({ from: "2027-04-01", to: "2027-03-01" }, TODAY);
    expect(result.range).toEqual({ from: "2026-06-16", to: "2027-06-15" });
    expect(result.notice).toMatch(/default/i);
  });

  test.each(["banana", "2027-13-01", "2027-02-30", "2027-1-1", ""])("C5721: %j is not a date, so the default and a notice come back", (from) => {
    const result = parseReportRange({ from, to: "2027-03-31" }, TODAY);
    expect(result.range).toEqual({ from: "2026-06-16", to: "2027-06-15" });
    expect(result.notice).not.toBeNull();
  });

  test("C5721: the default on a leap day stays a real date", () => {
    expect(parseReportRange({}, "2028-02-29").range).toEqual({ from: "2027-03-01", to: "2028-02-29" });
  });
});

describe("headline labels (reporting AC 3 to 5)", () => {
  test("C5722: no decisions reads 'No decisions yet', not 0%", () => {
    expect(winRate({ accepted: 0, refused: 0, expired: 0 })).toBe("No decisions yet");
  });

  test("C5722: accepted 1 and refused 1 is 50%", () => {
    expect(winRate({ accepted: 1, refused: 1, expired: 0 })).toBe("50%");
  });

  test("C5722: expired counts as a loss", () => {
    expect(winRate({ accepted: 1, refused: 0, expired: 2 })).toBe("33%");
  });

  test("C5723: null reads 'No signed contracts yet' and 4 reads '4.0 days'", () => {
    expect(signLabel(null)).toBe("No signed contracts yet");
    expect(signLabel(4)).toBe("4.0 days");
    expect(signLabel(1)).toBe("1.0 day");
  });
});

describe("funnel drop-off (reporting AC 6, 9)", () => {
  test("C5724: the first stage is 0 and 4 created then 2 sent is 50", () => {
    expect(dropOff([4, 2])).toEqual([0, 50]);
  });

  test("C5724: a stage after an empty one is 0, never a division by zero", () => {
    expect(dropOff([0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
    expect(dropOff([3, 0, 0])).toEqual([0, 100, 0]);
  });

  test("C5724: more at a later stage than the one before is 0, not negative", () => {
    expect(dropOff([2, 3])).toEqual([0, 0]);
  });
});

describe("CSV (reporting AC 15)", () => {
  const columns = [{ header: "Customer" }, { header: "Value", kind: "money" as const }, { header: "Ends" }];

  test("C5725: a header row, money in dollars with two decimals and dates as given", () => {
    expect(toCsv(columns, [["Acme", 119999, "2027-03-31"]])).toBe("Customer,Value,Ends\r\nAcme,1199.99,2027-03-31\r\n");
  });

  test("C5725: zero and single-digit cents keep two decimals", () => {
    expect(toCsv([{ header: "V", kind: "money" }], [[0], [5], [100]])).toBe("V\r\n0.00\r\n0.05\r\n1.00\r\n");
  });

  test("C5725: a comma, a quote and a newline are quoted, an inner quote is doubled", () => {
    expect(toCsv([{ header: "A" }], [["a,b"], ['say "hi"'], ["x\ny"]])).toBe('A\r\n"a,b"\r\n"say ""hi"""\r\n"x\ny"\r\n');
  });

  test.each(["=1+1", "+1", "-1", "@SUM(A1)"])("C5725: a text cell %j gets a leading single quote", (cell) => {
    expect(toCsv([{ header: "A" }], [[cell]])).toBe(`A\r\n'${cell}\r\n`);
  });

  test("C5725: a null cell is empty, and a negative money cell is not prefixed", () => {
    expect(toCsv([{ header: "A" }, { header: "V", kind: "money" }], [[null, -500]])).toBe("A,V\r\n,-5.00\r\n");
  });
});

describe("report access (reporting AC 13, 14)", () => {
  test.each([
    ["owner", "money"],
    ["admin", "money"],
    ["estimator", "operational"],
    ["viewer", "none"],
  ])("C5726: %s is %s", (role, access) => {
    expect(reportAccess(role)).toBe(access);
  });

  test("C5726: an unknown role is none", () => {
    expect(reportAccess("root")).toBe("none");
  });
});
