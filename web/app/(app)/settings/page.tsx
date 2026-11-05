import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SettingsView } from "@/components/settings/settings-view";
import { getContainer } from "@/composition";
import { saveSettingsAction } from "./actions";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { currentMember, getOrgSettings } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");

  return <SettingsView settings={await getOrgSettings(member.orgId)} role={member.role} action={saveSettingsAction} />;
}
