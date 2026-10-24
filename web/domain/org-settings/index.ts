/** Canadian province and territory codes; `org_settings.governing_province` stores one of these (door 4). */
export const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"] as const;

/** The settings form as submitted: every field is the text the member typed. */
export type OrgSettingsInput = {
  legalName: string;
  address: string;
  phone: string;
  accentColor: string;
  repairDiscountPct: string;
  cpiCapPct: string;
  cancellationNoticeDays: string;
  paymentDays: string;
  governingProvince: string;
  taxNote: string;
};

export type OrgSettingsField = keyof OrgSettingsInput;

/** The validated settings, ready to store: empty text is `null`. */
export type OrgSettingsValue = {
  legalName: string;
  address: string | null;
  phone: string | null;
  accentColor: string | null;
  repairDiscountPct: number;
  cpiCapPct: number;
  cancellationNoticeDays: number | null;
  paymentDays: number | null;
  governingProvince: string | null;
  taxNote: string | null;
};

export type OrgSettingsErrors = Partial<Record<OrgSettingsField, string>>;

export type OrgSettingsValidation = { ok: true; value: OrgSettingsValue } | { ok: false; errors: OrgSettingsErrors };

const MAX_DAYS = 365;

function optionalText(raw: string, max: number, label: string, errors: OrgSettingsErrors, field: OrgSettingsField) {
  const text = raw.trim();
  if (text.length > max) errors[field] = `${label} must be ${max} characters or fewer`;
  return text === "" ? null : text;
}

function percent(raw: string, label: string, errors: OrgSettingsErrors, field: OrgSettingsField) {
  const text = raw.trim();
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(text) || Number(text) > 100) {
    errors[field] = `${label} must be a number from 0 to 100 with at most two decimals`;
    return 0;
  }
  return Number(text);
}

function days(raw: string, label: string, errors: OrgSettingsErrors, field: OrgSettingsField) {
  const text = raw.trim();
  if (text === "") return null;
  if (!/^\d+$/.test(text) || Number(text) > MAX_DAYS) {
    errors[field] = `${label} must be a whole number from 0 to ${MAX_DAYS}`;
    return null;
  }
  return Number(text);
}

/** Checks the form on the server; the same rules back the database's own constraints. */
export function validateOrgSettings(input: OrgSettingsInput): OrgSettingsValidation {
  const errors: OrgSettingsErrors = {};

  const legalName = input.legalName.trim();
  if (legalName === "" || legalName.length > 120) errors.legalName = "Legal name must be 1 to 120 characters";

  const address = optionalText(input.address, 300, "Address", errors, "address");
  const phone = optionalText(input.phone, 40, "Phone", errors, "phone");
  const taxNote = optionalText(input.taxNote, 500, "Tax note", errors, "taxNote");

  const accentRaw = input.accentColor.trim();
  if (accentRaw !== "" && !/^#[0-9a-fA-F]{6}$/.test(accentRaw)) {
    errors.accentColor = "Accent colour must look like #1f6f8b";
  }

  const repairDiscountPct = percent(input.repairDiscountPct, "Repair discount", errors, "repairDiscountPct");
  const cpiCapPct = percent(input.cpiCapPct, "CPI cap", errors, "cpiCapPct");
  const cancellationNoticeDays = days(input.cancellationNoticeDays, "Cancellation notice", errors, "cancellationNoticeDays");
  const paymentDays = days(input.paymentDays, "Payment terms", errors, "paymentDays");

  const provinceRaw = input.governingProvince.trim();
  if (provinceRaw !== "" && !(PROVINCES as readonly string[]).includes(provinceRaw)) {
    errors.governingProvince = "Choose a province or territory from the list";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      legalName,
      address,
      phone,
      accentColor: accentRaw === "" ? null : accentRaw.toLowerCase(),
      repairDiscountPct,
      cpiCapPct,
      cancellationNoticeDays,
      paymentDays,
      governingProvince: provinceRaw === "" ? null : provinceRaw,
      taxNote,
    },
  };
}

/** A stored number as the form shows it: up to two decimals, no trailing zeros, `null` as empty. */
export function formatSettingNumber(value: number | null): string {
  return value === null ? "" : String(Number(value.toFixed(2)));
}
