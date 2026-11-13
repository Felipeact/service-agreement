import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsView } from "@/components/settings/settings-view";
import { getContainer } from "@/composition";
import { prepareLogoUpload } from "@/app/logo-upload";
import { saveSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { currentMember, getOrgSettings, billingLink, logo } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");

  const [settings, showBilling, logoPath] = await Promise.all([getOrgSettings(member.orgId), billingLink(member.orgId, member.billingRole ?? member.role), logo.current(member.orgId)]);
  return <SettingsView settings={settings} role={member.role} action={saveSettingsAction} billingLink={showBilling} logoPath={logoPath ?? ""} prepareLogo={prepareLogoUpload} />;
}
