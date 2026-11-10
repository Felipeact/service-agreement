import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsView } from "@/components/settings/settings-view";
import { getContainer } from "@/composition";
import { openBillingPortalAction } from "./billing-actions";
import { saveSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { currentMember, getOrgSettings, billingSection } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");

  const [settings, billing] = await Promise.all([getOrgSettings(member.orgId), billingSection(member.orgId, member.role)]);
  return <SettingsView settings={settings} role={member.role} action={saveSettingsAction} billing={billing} billingAction={openBillingPortalAction} />;
}
