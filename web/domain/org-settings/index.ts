import { isTermStart } from "@/domain/agreement/term";

/** Canadian province and territory codes; `org_settings.governing_province` stores one of these (door 4). */
export const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"] as const;

/** What the contract calls each province; a code outside the list is printed as stored. */
export const PROVINCE_NAMES: Record<(typeof PROVINCES)[number], string> = {
  AB: "Alberta",
  BC: "British Columbia",
  MB: "Manitoba",
  NB: "New Brunswick",
  NL: "Newfoundland and Labrador",
  NS: "Nova Scotia",
  NT: "the Northwest Territories",
  NU: "Nunavut",
  ON: "Ontario",
  PE: "Prince Edward Island",
  QC: "Quebec",
  SK: "Saskatchewan",
  YT: "Yukon",
};

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
  proposalValidityDays: string;
  itemSingular: string;
  itemPlural: string;
  /** The logo's key in the `logos` bucket, `""` for none (tenant-logo). Absent means the form did not carry it. */
  logoPath?: string;
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
  /** How many days a sent proposal stays open for a decision (proposal-expiry door 2). */
  proposalValidityDays: number;
  /** The org's words for the serviced item, lowercase (item-vocabulary door 1). */
  itemSingular: string;
  itemPlural: string;
  /** The logo's key, `null` for none; left out, the stored logo is not touched (tenant-logo). */
  logoPath?: string | null;
};

export type OrgSettingsErrors = Partial<Record<OrgSettingsField, string>>;

export type OrgSettingsValidation = { ok: true; value: OrgSettingsValue } | { ok: false; errors: OrgSettingsErrors };

const MAX_DAYS = 365;
const MAX_TERM_MONTHS = 60;

export const RENEWAL_CPI_ERROR = "CPI must be a number from -20 to 100 with at most two decimals";
export const RENEWAL_CPI_AS_OF_ERROR = "Enter the date this CPI was published";
export const RENEWAL_CPI_PAIR_ERROR = "Set both CPI and its date, or neither";
export const ITEM_WORD_ERROR = "Use 1 to 30 letters, spaces, hyphens or apostrophes, starting with a letter";
export const PROPOSAL_VALIDITY_ERROR = `Proposal validity must be a whole number of days from 1 to ${MAX_DAYS}`;

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

/** The same shape the `org_settings` check constraints enforce (item-vocabulary door 1), applied to the trimmed, lowercased word. */
const ITEM_WORD = /^[a-z][a-z' -]{0,29}$/;

function itemWord(raw: string, errors: OrgSettingsErrors, field: OrgSettingsField) {
  const word = raw.trim().toLowerCase();
  if (!ITEM_WORD.test(word)) errors[field] = ITEM_WORD_ERROR;
  return word;
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

  const proposalValidityDays = wholeNumber(input.proposalValidityDays, 1, MAX_DAYS, PROPOSAL_VALIDITY_ERROR, errors,
    "proposalValidityDays");

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

  const itemSingular = itemWord(input.itemSingular, errors, "itemSingular");
  const itemPlural = itemWord(input.itemPlural, errors, "itemPlural");

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
      proposalValidityDays,
      itemSingular,
      itemPlural,
    },
  };
}

/** A stored number as the form shows it: up to two decimals, no trailing zeros, `null` as empty. */
export function formatSettingNumber(value: number | null): string {
  return value === null ? "" : String(Number(value.toFixed(2)));
}

/** What the copy needs from the org's two stored words: each form lowercase and capitalised (item-vocabulary door 3). */
export type ItemWords = { singular: string; plural: string; Singular: string; Plural: string };

/** What an org that never chose a word is called, and what a payload without the words falls back to. */
export const DEFAULT_ITEM_WORD = "equipment";

/** "an area", "an hour", "a unit", "a user": the sound decides, not the letter, for the few English words that differ. */
const startsWithVowelSound = (word: string) => (/^(hour|honest|heir)/i.test(word) ? true : /^(uni|use|usu|uti|eu|one)/i.test(word) ? false : /^[aeiou]/i.test(word));

const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** The only place an item word changes case: screens and documents take the form they need from here. */
export function itemWords(singular: string, plural: string): ItemWords {
  return { singular, plural, Singular: capitalise(singular), Plural: capitalise(plural) };
}

export const DEFAULT_ITEM_WORDS: ItemWords = itemWords(DEFAULT_ITEM_WORD, DEFAULT_ITEM_WORD);

/** A mass noun such as equipment takes the singular form of a verb; a countable one takes the plural. */
export const itemVerb = (words: ItemWords, mass: string, plural: string) => (words.singular === words.plural ? mass : plural);

/** The past-tense verb for the plural word: "was" for a mass noun such as equipment, else "were". */
export const itemWas = (words: ItemWords) => itemVerb(words, "was", "were");

/**
 * Copy written for the default word, spoken in the org's: "equipment list" and "equipment type" take the singular as a
 * modifier, any other "equipment" the plural, a capital stays a capital, and "an" before it follows the new word. With the default words nothing changes.
 */
export function itemText(text: string, words: ItemWords): string {
  return text.replace(/\b(?:([Aa])n )?([Ee])quipment( (?:list|type|import|catalog)s?)?\b/g, (_match, a: string | undefined, first: string, tail: string | undefined) => {
    const word = tail ? words.singular : words.plural;
    const article = a ? a + (startsWithVowelSound(word) ? "n " : " ") : "";
    return article + (first === "E" ? capitalise(word) : word) + (tail ?? "");
  });
}

/** "1 station", "0 stations", "2 stations". */
export function countItems(count: number, words: ItemWords): string {
  return `${count} ${count === 1 ? words.singular : words.plural}`;
}
