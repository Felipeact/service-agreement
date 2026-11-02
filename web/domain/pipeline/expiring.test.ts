import { describe, expect, test } from "vitest";
import { addDays, expiringLabel } from ".";

const TODAY = "2027-12-01";

describe("Expiring soon labels (renewal AC 37 to 40)", () => {
  test("C1210: no renewal and a notice date ahead", () => {
    expect(expiringLabel({ noticeDate: "2027-12-15", renewal: null, openAgreement: null }, TODAY)).toBe(
      "Renews on Dec 15, 2027: automatic or renegotiated by CPI",
    );
  });

  test("C1210: an accepted renewal", () => {
    expect(expiringLabel({ noticeDate: "2027-11-20", renewal: { id: "r", number: "AG-1013", status: "accepted" }, openAgreement: null }, TODAY)).toBe(
      "Auto-renewed as AG-1013",
    );
  });

  test("C1210: a draft renewal", () => {
    expect(expiringLabel({ noticeDate: "2027-11-20", renewal: { id: "r", number: "AG-1013", status: "draft" }, openAgreement: null }, TODAY)).toBe(
      "Renewal draft AG-1013",
    );
  });

  test("C1210: past the notice date, no renewal, the site's agreement open", () => {
    expect(expiringLabel({ noticeDate: "2027-11-20", renewal: null, openAgreement: "AG-1009" }, TODAY)).toBe("Renewal blocked: AG-1009 is open");
  });

  test("addDays crosses month and leap-year ends", () => {
    expect(addDays("2027-12-01", 90)).toBe("2028-02-29");
    expect(addDays("2027-12-31", -30)).toBe("2027-12-01");
  });
});

test("addDays matches the calendar across eras of dates", () => {
  expect(addDays("2000-02-28", 1)).toBe("2000-02-29");
  expect(addDays("2100-02-28", 1)).toBe("2100-03-01");
  expect(addDays("2028-01-01", -1)).toBe("2027-12-31");
  expect(addDays("1970-01-01", 0)).toBe("1970-01-01");
});
