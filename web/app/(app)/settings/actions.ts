"use server";

import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { validateOrgSettings, type OrgSettingsInput } from "@/domain/org-settings";
import { isOwnLogoPath, LOGO_PATH_ERROR } from "@/domain/org-settings/logo";
import type { SettingsFormState } from "@/components/settings/state";
import { readFields, readPostedFields } from "@/lib/forms/server-input";

/** Every settings field is text; only these names are read (Zod, `readFields`). */
const SETTINGS_FIELDS = [
  "legalName", "address", "phone", "accentColor", "repairDiscountPct", "cpiCapPct", "cancellationNoticeDays", "paymentDays", "governingProvince", "taxNote",
  "defaultTermMonths", "renewalNoticeDays", "cpiRenegotiationThresholdPct", "renewalCpiPct", "renewalCpiAsOf", "proposalValidityDays", "itemSingular", "itemPlural",
] as const;

const readInput = (formData: FormData): OrgSettingsInput => readFields(formData, SETTINGS_FIELDS);

/** Validates the form, then overwrites the member's org settings. Never throws for a refusal. */
export async function saveSettingsAction(_state: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const carriesLogo = formData.has("logoPath");
  const values = { ...readInput(formData), ...readPostedFields(formData, ["logoPath"]) };
  const { currentMember, saveOrgSettings, logo } = await getContainer();

  const member = await currentMember();
  if (member.status !== "member") redirect("/login");

  const checked = validateOrgSettings(values);
  const logoRefused = values.logoPath !== undefined && !isOwnLogoPath(member.orgId, values.logoPath);
  if (!checked.ok || logoRefused) {
    return { status: "invalid", errors: { ...(checked.ok ? {} : checked.errors), ...(logoRefused && { logoPath: LOGO_PATH_ERROR }) }, values };
  }

  // The logo that is stored now, read before the save so a replaced or removed one can be deleted after it.
  const previous = carriesLogo ? await logo.current(member.orgId).catch(() => null) : null;
  const next = values.logoPath === undefined ? undefined : values.logoPath === "" ? null : values.logoPath;
  const saved = await saveOrgSettings(member.orgId, next === undefined ? checked.value : { ...checked.value, logoPath: next });
  if (!saved.ok) return { status: saved.code, values };
  if (previous && next !== undefined && previous !== next) await logo.remove(previous);
  return { status: "saved", values };
}
