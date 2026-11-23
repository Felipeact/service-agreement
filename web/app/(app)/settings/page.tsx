import type { Metadata } from "next";
import { prepareLogoUpload } from "@/app/logo-upload";
import { saveSettingsAction } from "./actions";
import { SettingsView } from "./_components/content";
import { loadSettings } from "./_data-access/settings";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { role, settings, billingLink, logoPath } = await loadSettings();
  return <SettingsView settings={settings} role={role} action={saveSettingsAction} billingLink={billingLink} logoPath={logoPath} prepareLogo={prepareLogoUpload} />;
}
