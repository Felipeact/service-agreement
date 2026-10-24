import { describe, expect, test } from "vitest";
import { PROVINCES, formatSettingNumber, validateOrgSettings, type OrgSettingsField, type OrgSettingsInput } from "./index";

const valid: OrgSettingsInput = {
  legalName: "Kettle Ridge Mechanical Ltd.",
  address: "100 Sample Street, Burnaby, BC V5A 0A0",
  phone: "604-555-0100",
  accentColor: "#1f6f8b",
  repairDiscountPct: "10",
  cpiCapPct: "5",
  cancellationNoticeDays: "30",
  paymentDays: "30",
  governingProvince: "BC",
  taxNote: "Prices exclude applicable taxes (GST and PST).",
};

const run = (patch: Partial<OrgSettingsInput>) => validateOrgSettings({ ...valid, ...patch });
const a = (n: number) => "a".repeat(n);

function rejects(field: OrgSettingsField, value: string) {
  const result = run({ [field]: value });
  expect(result.ok, `${field}=${JSON.stringify(value).slice(0, 20)} should be rejected`).toBe(false);
  if (!result.ok) expect(Object.keys(result.errors)).toEqual([field]);
}

function accepts(field: OrgSettingsField, value: string) {
  const result = run({ [field]: value });
  expect(result.ok, `${field}=${JSON.stringify(value).slice(0, 20)} should be accepted`).toBe(true);
  return result.ok ? result.value : undefined;
}

describe("validateOrgSettings", () => {
  test("C147: legal name 1-120 characters after trimming", () => {
    rejects("legalName", "");
    rejects("legalName", "   ");
    rejects("legalName", a(121));
    expect(accepts("legalName", a(120))?.legalName).toHaveLength(120);
  });

  test("C147: address, phone and tax note bounds", () => {
    rejects("address", a(301));
    expect(accepts("address", a(300))?.address).toHaveLength(300);
    expect(accepts("address", "")?.address).toBeNull();
    rejects("phone", a(41));
    expect(accepts("phone", a(40))?.phone).toHaveLength(40);
    rejects("taxNote", a(501));
    expect(accepts("taxNote", a(500))?.taxNote).toHaveLength(500);
  });

  test("C147: accent colour is empty or #rrggbb, stored lowercase", () => {
    rejects("accentColor", "1f6f8b");
    rejects("accentColor", "#12345");
    rejects("accentColor", "#12345g");
    expect(accepts("accentColor", "")?.accentColor).toBeNull();
    expect(accepts("accentColor", "#1F6F8B")?.accentColor).toBe("#1f6f8b");
  });

  test.each(["repairDiscountPct", "cpiCapPct"] as const)("C147: %s is a number from 0 to 100 with at most two decimals", (field) => {
    for (const bad of ["100.01", "-0.01", "5.123", "", "abc"]) rejects(field, bad);
    expect(accepts(field, "0")?.[field]).toBe(0);
    expect(accepts(field, "100")?.[field]).toBe(100);
  });

  test.each(["cancellationNoticeDays", "paymentDays"] as const)("C147: %s is empty or a whole number from 0 to 365", (field) => {
    for (const bad of ["366", "-1", "1.5"]) rejects(field, bad);
    expect(accepts(field, "")?.[field]).toBeNull();
    expect(accepts(field, "0")?.[field]).toBe(0);
    expect(accepts(field, "365")?.[field]).toBe(365);
  });

  test("C147: province is empty or one of the listed codes", () => {
    rejects("governingProvince", "XX");
    rejects("governingProvince", "bc");
    expect(accepts("governingProvince", "")?.governingProvince).toBeNull();
    expect(accepts("governingProvince", "BC")?.governingProvince).toBe("BC");
  });

  test("C149: text is trimmed and blank optional text becomes null", () => {
    const result = run({ legalName: "  Acme Ltd.  ", address: "   " });
    expect(result).toMatchObject({ ok: true, value: { legalName: "Acme Ltd.", address: null } });
  });
});

describe("formatSettingNumber", () => {
  test.each([
    [10, "10"],
    [5.5, "5.5"],
    [5.25, "5.25"],
    [0, "0"],
    [null, ""],
  ])("C143: %s shows as %j", (value, shown) => {
    expect(formatSettingNumber(value)).toBe(shown);
  });
});

describe("provinces", () => {
  test("C154: the list is exactly the thirteen codes", () => {
    expect([...PROVINCES]).toEqual(["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"]);
    for (const code of PROVINCES) expect(accepts("governingProvince", code)?.governingProvince).toBe(code);
  });
});
