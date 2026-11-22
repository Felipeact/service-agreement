import type { OrgSettings } from "@/application/ports";
import type { SetupProfileField, SetupProfileInput } from "@/domain/org-settings/setup";

/** What the setup form shows after an attempt; every state past `idle` keeps what was typed. */
export type SetupFormState =
  | { status: "idle" }
  | { status: "invalid"; errors: Partial<Record<SetupProfileField, string>>; values: SetupProfileInput }
  | { status: "forbidden" | "unavailable"; values: SetupProfileInput };

/** The stored settings as the setup form's text fields. */
export function toSetupInput(settings: OrgSettings): SetupProfileInput {
  return {
    legalName: settings.legalName,
    address: settings.address ?? "",
    phone: settings.phone ?? "",
    accentColor: settings.accentColor ?? "",
    governingProvince: settings.governingProvince ?? "",
    itemSingular: settings.itemSingular,
    itemPlural: settings.itemPlural,
  };
}
