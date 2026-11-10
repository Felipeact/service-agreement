"use server";

import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { setupGate, validateSetupProfile, type SetupProfileInput } from "@/domain/org-settings/setup";
import type { SetupFormState } from "@/components/setup/state";

function readInput(formData: FormData): SetupProfileInput {
  const text = (name: keyof SetupProfileInput) => String(formData.get(name) ?? "");
  return {
    legalName: text("legalName"),
    address: text("address"),
    phone: text("phone"),
    accentColor: text("accentColor"),
    governingProvince: text("governingProvince"),
    itemSingular: text("itemSingular"),
    itemPlural: text("itemPlural"),
  };
}

/**
 * Finishes first-login setup: `save` validates the profile, stores it and stamps the org; `skip` only stamps it.
 * A refusal or a failure comes back as state and stamps nothing. Never throws for a refusal.
 */
export async function setupAction(_state: SetupFormState, formData: FormData): Promise<SetupFormState> {
  const values = readInput(formData);
  const { currentMember, saveSetupProfile, skipSetup } = await getContainer();

  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  // Only an owner or admin has setup to do; anyone else is sent where they belong.
  if (setupGate(member.role, true) === "proceed") redirect("/pipeline");

  if (formData.get("intent") === "skip") {
    const skipped = await skipSetup(member.orgId);
    if (!skipped.ok) return { status: skipped.code, values };
    redirect("/pipeline");
  }

  const checked = validateSetupProfile(values);
  if (!checked.ok) return { status: "invalid", errors: checked.errors, values };

  const saved = await saveSetupProfile(member.orgId, checked.value);
  if (!saved.ok) return { status: saved.code, values };
  redirect("/pipeline");
}
