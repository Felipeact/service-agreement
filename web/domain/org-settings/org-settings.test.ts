import { describe, expect, test } from "vitest";
import { DEFAULT_ITEM_WORDS, PROVINCES, countItems, formatSettingNumber, itemText, itemWords, validateOrgSettings, type OrgSettingsField, type OrgSettingsInput } from "./index";

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
  defaultTermMonths: "12",
  renewalNoticeDays: "30",
  cpiRenegotiationThresholdPct: "5",
  renewalCpiPct: "",
  renewalCpiAsOf: "",
  proposalValidityDays: "30", itemSingular: "equipment", itemPlural: "equipment",
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

describe("the renewal settings", () => {
  test.each([
    ["defaultTermMonths", "1", 1],
    ["defaultTermMonths", "12", 12],
    ["defaultTermMonths", "60", 60],
    ["renewalNoticeDays", "0", 0],
    ["renewalNoticeDays", "30", 30],
    ["renewalNoticeDays", "365", 365],
    ["cpiRenegotiationThresholdPct", "0", 0],
    ["cpiRenegotiationThresholdPct", "5", 5],
    ["cpiRenegotiationThresholdPct", "4.75", 4.75],
    ["cpiRenegotiationThresholdPct", "100", 100],
  ] as const)("C1132: %s %j is accepted as %d", (field, raw, value) => {
    const result = run({ [field]: raw });
    expect(result.ok && result.value[field]).toBe(value);
  });

  const TERM = "Default term must be a whole number of months from 1 to 60";
  const NOTICE = "Renewal notice must be a whole number from 0 to 365";
  const THRESHOLD = "CPI renegotiation threshold must be a number from 0 to 100 with at most two decimals";
  test.each([
    ["defaultTermMonths", "", TERM],
    ["defaultTermMonths", "0", TERM],
    ["defaultTermMonths", "61", TERM],
    ["defaultTermMonths", "1.5", TERM],
    ["defaultTermMonths", "abc", TERM],
    ["renewalNoticeDays", "", NOTICE],
    ["renewalNoticeDays", "366", NOTICE],
    ["renewalNoticeDays", "-1", NOTICE],
    ["renewalNoticeDays", "2.5", NOTICE],
    ["cpiRenegotiationThresholdPct", "", THRESHOLD],
    ["cpiRenegotiationThresholdPct", "100.01", THRESHOLD],
    ["cpiRenegotiationThresholdPct", "5.123", THRESHOLD],
    ["cpiRenegotiationThresholdPct", "-1", THRESHOLD],
  ] as const)("C1132: %s %j gives its error", (field, raw, message) => {
    expect(run({ [field]: raw })).toEqual({ ok: false, errors: { [field]: message } });
  });
});

describe("renewal CPI (renewal S1)", () => {
  const cpi = (renewalCpiPct: string, renewalCpiAsOf: string) => run({ renewalCpiPct, renewalCpiAsOf });

  test.each(["3.2", "-20", "0", "100", "4.75"])("C1168: accepts CPI %s with a date", (pct) => {
    const result = cpi(pct, "2027-10-15");
    expect(result).toMatchObject({ ok: true, value: { renewalCpiPct: Number(pct), renewalCpiAsOf: "2027-10-15" } });
  });

  test("C1168: both empty is both null", () => {
    expect(cpi("", "")).toMatchObject({ ok: true, value: { renewalCpiPct: null, renewalCpiAsOf: null } });
  });

  test.each(["-20.01", "100.01", "3.123", "abc"])("C1168: CPI %s is refused", (pct) => {
    expect(cpi(pct, "2027-10-15")).toEqual({
      ok: false,
      errors: { renewalCpiPct: "CPI must be a number from -20 to 100 with at most two decimals" },
    });
  });

  test.each(["2027-02-30", "1999-12-31", "2100-01-01", "15/10/2027"])("C1168: date %s is refused", (date) => {
    expect(cpi("3.2", date)).toEqual({ ok: false, errors: { renewalCpiAsOf: "Enter the date this CPI was published" } });
  });

  test("C1168: one without the other is refused", () => {
    expect(cpi("3.2", "")).toEqual({ ok: false, errors: { renewalCpiAsOf: "Set both CPI and its date, or neither" } });
    expect(cpi("", "2027-10-15")).toEqual({ ok: false, errors: { renewalCpiPct: "Set both CPI and its date, or neither" } });
  });

  test.each([["1", 1], ["30", 30], ["365", 365]])("C1222: accepts proposal validity %s days", (raw, days) => {
    expect(run({ proposalValidityDays: raw })).toMatchObject({ ok: true, value: { proposalValidityDays: days } });
  });

  test.each(["0", "366", "1.5", "abc", ""])("C1222: proposal validity %j is refused", (raw) => {
    expect(run({ proposalValidityDays: raw })).toEqual({
      ok: false,
      errors: { proposalValidityDays: "Proposal validity must be a whole number of days from 1 to 365" },
    });
  });
});

const WORD_MESSAGE = "Use 1 to 30 letters, spaces, hyphens or apostrophes, starting with a letter";

describe("item words", () => {
  test("C2001: Station and STATIONS are stored trimmed and lowercased", () => {
    const result = run({ itemSingular: "  Station ", itemPlural: "STATIONS" });
    expect(result.ok && [result.value.itemSingular, result.value.itemPlural]).toEqual(["station", "stations"]);
  });

  test.each(["itemSingular", "itemPlural"] as const)("C2003: %s rejects the shapes that cannot be printed and accepts the others", (field) => {
    for (const bad of ["", "   ", a(31), "Station1", "-station", "Sta<b>", "Étage"]) {
      const result = run({ [field]: bad });
      expect(result.ok, `${field}=${JSON.stringify(bad)} should be rejected`).toBe(false);
      if (!result.ok) expect(result.errors).toEqual({ [field]: WORD_MESSAGE });
    }
    for (const good of ["a", a(30), "walk-in", "O'Brien area"]) {
      const result = run({ [field]: good });
      expect(result.ok, `${field}=${JSON.stringify(good)} should be accepted`).toBe(true);
    }
  });

  test("C2010: the words give four forms, capitalise only the first letter, and count with the singular for one", () => {
    expect(itemWords("station", "stations")).toEqual({ singular: "station", plural: "stations", Singular: "Station", Plural: "Stations" });
    const hyphen = itemWords("walk-in", "walk-ins");
    expect([hyphen.Singular, hyphen.Plural]).toEqual(["Walk-in", "Walk-ins"]);
    const mass = itemWords("equipment", "equipment");
    expect([mass.Singular, mass.Plural]).toEqual(["Equipment", "Equipment"]);
    const words = itemWords("station", "stations");
    expect([countItems(1, words), countItems(0, words), countItems(2, words)]).toEqual(["1 station", "0 stations", "2 stations"]);
  });
});

describe("item text", () => {
  const stations = itemWords("station", "stations");
  test("C2010: copy written for equipment is spoken in the org's words, and the default changes nothing", () => {
    expect(itemText("Import equipment list", stations)).toBe("Import station list");
    expect(itemText("Equipment type", stations)).toBe("Station type");
    expect(itemText("Equipment types not recognised", stations)).toBe("Station types not recognised");
    expect(itemText("This document lists more equipment than can be read at once.", stations)).toBe("This document lists more stations than can be read at once.");
    expect(itemText("Equipment, no agreement yet", stations)).toBe("Stations, no agreement yet");
    for (const text of ["Import equipment list", "Equipment types not recognised", "No equipment on this site yet.", "Equipment"]) {
      expect(itemText(text, DEFAULT_ITEM_WORDS)).toBe(text);
    }
  });
});

describe("item text, articles", () => {
  test("C2010: an before the word follows the word it now precedes, and the default keeps an", () => {
    const stations = itemWords("station", "stations");
    expect(itemText("Choose an equipment list", stations)).toBe("Choose a station list");
    expect(itemText("Drag an equipment list here", stations)).toBe("Drag a station list here");
    expect(itemText("Choose an equipment type", itemWords("area", "areas"))).toBe("Choose an area type");
    expect(itemText("Choose an equipment type", DEFAULT_ITEM_WORDS)).toBe("Choose an equipment type");
  });
});

describe("item text, sound of the article", () => {
  test("C2010: a before a consonant sound and an before a vowel sound, and catalog takes the singular", () => {
    expect(itemText("Choose an equipment list", itemWords("unit", "units"))).toBe("Choose a unit list");
    expect(itemText("Choose an equipment list", itemWords("hour", "hours"))).toBe("Choose an hour list");
    expect(itemText("Choose an equipment list", itemWords("user", "users"))).toBe("Choose a user list");
    expect(itemText("Your equipment catalog is empty.", itemWords("station", "stations"))).toBe("Your station catalog is empty.");
    expect(itemText("Your equipment catalog is empty.", DEFAULT_ITEM_WORDS)).toBe("Your equipment catalog is empty.");
  });
});
