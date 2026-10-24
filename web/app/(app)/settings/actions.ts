"use server";

import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { validateOrgSettings, type OrgSettingsInput } from "@/domain/org-settings";
import type { SettingsFormState } from "@/components/settings/state";

function readInput(formData: FormData): OrgSettingsInput {
  const text = (name: keyof OrgSettingsInput) => String(formData.get(name) ?? "");
  return {
    legalName: text("legalName"),
    address: text("address"),
    phone: text("phone"),
    accentColor: text("accentColor"),
    repairDiscountPct: text("repairDiscountPct"),
    cpiCapPct: text("cpiCapPct"),
    cancellationNoticeDays: text("cancellationNoticeDays"),
    paymentDays: text("paymentDays"),
    governingProvince: text("governingProvince"),
    taxNote: text("taxNote"),
  };
}

/** Validates the form, then overwrites the member's org settings. Never throws for a refusal. */
export async function saveSettingsAction(_state: SettingsFormState, formData: FormData): Promise<SettingsFormState> {
  const values = readInput(formData);
  const { currentMember, saveOrgSettings } = await getContainer();

  const member = await currentMember();
  if (member.status !== "member") redirect("/login");

  const checked = validateOrgSettings(values);
  if (!checked.ok) return { status: "invalid", errors: checked.errors, values };

  const saved = await saveOrgSettings(member.orgId, checked.value);
  return saved.ok ? { status: "saved", values } : { status: saved.code, values };
}
