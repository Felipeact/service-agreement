import { isTermStart } from "@/domain/agreement/term";

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
  defaultTermMonths: string;
  renewalNoticeDays: string;
  cpiRenegotiationThresholdPct: string;
  renewalCpiPct: string;
  renewalCpiAsOf: string;
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
  defaultTermMonths: number;
  renewalNoticeDays: number;
  cpiRenegotiationThresholdPct: number;
  /** The CPI W7 renews with and the date it was published (renewal door 2): both set or both `null`. */
  renewalCpiPct: number | null;
  renewalCpiAsOf: string | null;
};

export type OrgSettingsErrors = Partial<Record<OrgSettingsField, string>>;

export type OrgSettingsValidation = { ok: true; value: OrgSettingsValue } | { ok: false; errors: OrgSettingsErrors };

const MAX_DAYS = 365;
const MAX_TERM_MONTHS = 60;

export const RENEWAL_CPI_ERROR = "CPI must be a number from -20 to 100 with at most two decimals";
export const RENEWAL_CPI_AS_OF_ERROR = "Enter the date this CPI was published";
export const RENEWAL_CPI_PAIR_ERROR = "Set both CPI and its date, or neither";

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

function wholeNumber(raw: string, min: number, max: number, message: string, errors: OrgSettingsErrors, field: OrgSettingsField) {
  const text = raw.trim();
  if (!/^\d+$/.test(text) || Number(text) < min || Number(text) > max) {
    errors[field] = message;
    return min;
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

  // The renewal settings always hold a value (term-dates door 2), so none of them may be left empty.
  const defaultTermMonths = wholeNumber(input.defaultTermMonths, 1, MAX_TERM_MONTHS,
    `Default term must be a whole number of months from 1 to ${MAX_TERM_MONTHS}`, errors, "defaultTermMonths");
  const renewalNoticeDays = wholeNumber(input.renewalNoticeDays, 0, MAX_DAYS,
    `Renewal notice must be a whole number from 0 to ${MAX_DAYS}`, errors, "renewalNoticeDays");
  const cpiRenegotiationThresholdPct = percent(input.cpiRenegotiationThresholdPct, "CPI renegotiation threshold", errors,
    "cpiRenegotiationThresholdPct");

  // The renewal CPI and its date go together, so W7 always knows how old the figure is (renewal door 2).
  const cpiRaw = input.renewalCpiPct.trim();
  const asOfRaw = input.renewalCpiAsOf.trim();
  let renewalCpiPct: number | null = null;
  if (cpiRaw !== "") {
    if (!/^-?\d{1,3}(\.\d{1,2})?$/.test(cpiRaw) || Number(cpiRaw) < -20 || Number(cpiRaw) > 100) errors.renewalCpiPct = RENEWAL_CPI_ERROR;
    else renewalCpiPct = Number(cpiRaw);
  }
  if (asOfRaw !== "" && !isTermStart(asOfRaw)) errors.renewalCpiAsOf = RENEWAL_CPI_AS_OF_ERROR;
  if (cpiRaw === "" && asOfRaw !== "") errors.renewalCpiPct = RENEWAL_CPI_PAIR_ERROR;
  if (cpiRaw !== "" && asOfRaw === "") errors.renewalCpiAsOf = RENEWAL_CPI_PAIR_ERROR;

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
      defaultTermMonths,
      renewalNoticeDays,
      cpiRenegotiationThresholdPct,
      renewalCpiPct,
      renewalCpiAsOf: asOfRaw === "" ? null : asOfRaw,
    },
  };
}

/** A stored number as the form shows it: up to two decimals, no trailing zeros, `null` as empty. */
export function formatSettingNumber(value: number | null): string {
  return value === null ? "" : String(Number(value.toFixed(2)));
}
