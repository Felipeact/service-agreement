"use server";

import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { isOwnLogoPath, LOGO_PATH_ERROR } from "@/domain/org-settings/logo";
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
  const carriesLogo = formData.has("logoPath");
  const values = { ...readInput(formData), ...(carriesLogo && { logoPath: String(formData.get("logoPath") ?? "") }) };
  const { currentMember, saveSetupProfile, skipSetup, logo } = await getContainer();

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
  const logoRefused = values.logoPath !== undefined && !isOwnLogoPath(member.orgId, values.logoPath);
  if (!checked.ok || logoRefused) {
    return { status: "invalid", errors: { ...(checked.ok ? {} : checked.errors), ...(logoRefused && { logoPath: LOGO_PATH_ERROR }) }, values };
  }

  const previous = carriesLogo ? await logo.current(member.orgId).catch(() => null) : null;
  const next = values.logoPath === undefined ? undefined : values.logoPath === "" ? null : values.logoPath;
  const saved = await saveSetupProfile(member.orgId, next === undefined ? checked.value : { ...checked.value, logoPath: next });
  if (!saved.ok) return { status: saved.code, values };
  if (previous && next !== undefined && previous !== next) await logo.remove(previous);
  redirect("/pipeline");
}
