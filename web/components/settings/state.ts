import type { MemberRole, OrgSettings } from "@/application/ports";
import { formatSettingNumber, type OrgSettingsErrors, type OrgSettingsInput } from "@/domain/org-settings";

/** What the settings form shows after a save attempt; every state past `idle` keeps what was typed. */
export type SettingsFormState =
  | { status: "idle" }
  | { status: "saved"; values: OrgSettingsInput }
  | { status: "invalid"; errors: OrgSettingsErrors; values: OrgSettingsInput }
  | { status: "forbidden" | "unavailable"; values: OrgSettingsInput };

/** The stored settings as the form's text fields. */
export function toInput(settings: OrgSettings): OrgSettingsInput {
  return {
    legalName: settings.legalName,
    address: settings.address ?? "",
    phone: settings.phone ?? "",
    accentColor: settings.accentColor ?? "",
    repairDiscountPct: formatSettingNumber(settings.repairDiscountPct),
    cpiCapPct: formatSettingNumber(settings.cpiCapPct),
    cancellationNoticeDays: formatSettingNumber(settings.cancellationNoticeDays),
    paymentDays: formatSettingNumber(settings.paymentDays),
    governingProvince: settings.governingProvince ?? "",
    taxNote: settings.taxNote ?? "",
  };
}

/** Owners and admins write settings (the `org_settings` update policy); RLS still has the last word. */
export function canEditSettings(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}
