import type { Role as MemberRole } from "@/domain/members";
import { TRADES } from "@/domain/billing";
import { itemText, validateOrgSettings, type ItemWords, type OrgSettingsErrors, type OrgSettingsInput } from "./index";

/** Owners and admins write company settings (AD-025), so they are the roles first-login setup is for. */
const MANAGERS: readonly MemberRole[] = ["owner", "admin"];

/** What Pipeline does for a member: take an owner or admin of a pending org to `/setup`, leave everyone else alone. */
export function setupGate(role: MemberRole, pending: boolean): "setup" | "proceed" {
  return pending && MANAGERS.includes(role) ? "setup" : "proceed";
}

/** The signed-in state `/setup` decides on; the same shape as `CurrentMember`, with only what the decision reads. */
export type SetupViewer =
  | { status: "signed_out" }
  | { status: "no_membership" }
  | { status: "member"; role: MemberRole };

export type SetupEntry = { to: "/login" } | { to: "/pipeline" } | { to: "render" };

/** Who sees the `/setup` screen: a manager of an org whose setup is pending. Everyone else is sent away. */
export function setupEntry(viewer: SetupViewer, pending: boolean): SetupEntry {
  if (viewer.status === "signed_out") return { to: "/login" };
  if (viewer.status === "no_membership") return { to: "/pipeline" };
  return setupGate(viewer.role, pending) === "setup" ? { to: "render" } : { to: "/pipeline" };
}

/** The setup form as submitted: the profile fields only. */
export type SetupProfileInput = Pick<
  OrgSettingsInput,
  "legalName" | "address" | "phone" | "accentColor" | "governingProvince" | "itemSingular" | "itemPlural" | "logoPath"
>;

export type SetupProfileField = keyof SetupProfileInput;

export type SetupProfileValue = {
  legalName: string;
  address: string | null;
  phone: string | null;
  accentColor: string | null;
  governingProvince: string;
  itemSingular: string;
  itemPlural: string;
  /** The logo's key, `null` for none; left out, the stored logo is not touched (tenant-logo). */
  logoPath?: string | null;
};

export type SetupProfileValidation =
  | { ok: true; value: SetupProfileValue }
  | { ok: false; errors: Partial<Record<SetupProfileField, string>> };

export const SETUP_PROVINCE_ERROR = "Choose your province or territory";

/** Values the Settings validator accepts for the fields this screen does not ask about. */
const UNASKED: Omit<OrgSettingsInput, keyof SetupProfileInput> = {
  repairDiscountPct: "0",
  cpiCapPct: "0",
  cancellationNoticeDays: "",
  paymentDays: "",
  taxNote: "",
  defaultTermMonths: "12",
  renewalNoticeDays: "30",
  cpiRenegotiationThresholdPct: "5",
  renewalCpiPct: "",
  renewalCpiAsOf: "",
  proposalValidityDays: "30",
};

const PROFILE_FIELDS: readonly SetupProfileField[] = [
  "legalName", "address", "phone", "accentColor", "governingProvince", "itemSingular", "itemPlural",
];

/**
 * The profile fields under the same rules as `/settings` (it is the same validator), with the province required here:
 * the contract prints it and a provisioned org has none.
 */
export function validateSetupProfile(input: SetupProfileInput): SetupProfileValidation {
  const checked = validateOrgSettings({ ...UNASKED, ...input });
  const errors: OrgSettingsErrors = checked.ok ? {} : checked.errors;
  const profileErrors: Partial<Record<SetupProfileField, string>> = {};
  for (const field of PROFILE_FIELDS) if (errors[field]) profileErrors[field] = errors[field];
  if (input.governingProvince.trim() === "") profileErrors.governingProvince = SETUP_PROVINCE_ERROR;
  if (Object.keys(profileErrors).length > 0 || !checked.ok) return { ok: false, errors: profileErrors };
  const { value } = checked;
  return {
    ok: true,
    value: {
      legalName: value.legalName,
      address: value.address,
      phone: value.phone,
      accentColor: value.accentColor,
      governingProvince: value.governingProvince ?? input.governingProvince.trim(),
      itemSingular: value.itemSingular,
      itemPlural: value.itemPlural,
    },
  };
}

/** One type of the org's catalog as the review reads it: the pack it came from (`null` for one made by hand) and its name. */
export type SetupCatalogType = { pack: string | null; name: string };

export type SetupCatalogGroup = {
  /** The pack code, or `null` for the types the org added itself. */
  pack: string | null;
  label: string;
  count: number;
  /** "20 equipment types", with the org's word for the item. */
  countText: string;
  names: string[];
};

const ADDED_BY_YOU = "Added by you";

/**
 * The review: the org's types grouped by pack in the order the trades are offered at sign-up, a pack this build does not
 * know after those, then the types of no pack. Names keep the order they came in.
 */
export function groupSetupCatalog(types: readonly SetupCatalogType[], words: ItemWords): SetupCatalogGroup[] {
  const known = TRADES.filter((trade) => trade.code !== "other").map((trade) => trade.code as string);
  const packs = [...new Set(types.map((type) => type.pack))];
  const rank = (pack: string | null) => (pack === null ? Number.MAX_SAFE_INTEGER : known.indexOf(pack) === -1 ? known.length : known.indexOf(pack));
  packs.sort((a, b) => rank(a) - rank(b));
  return packs.map((pack) => {
    const names = types.filter((type) => type.pack === pack).map((type) => type.name);
    const label = pack === null ? ADDED_BY_YOU : (TRADES.find((trade) => trade.code === pack)?.label ?? pack);
    return {
      pack,
      label,
      count: names.length,
      countText: `${names.length} ${itemText(names.length === 1 ? "equipment type" : "equipment types", words)}`,
      names,
    };
  });
}
