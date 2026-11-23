import { redirect } from "next/navigation";
import { getContainer } from "@/composition";

/**
 * What the Settings page reads: the org's settings, whether to list Billing (the org has a subscription this member may
 * manage) and the stored logo key. Signed out goes to /login.
 */
export async function loadSettings() {
  const { currentMember, getOrgSettings, billingLink, logo } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const [settings, billingLinked, logoPath] = await Promise.all([getOrgSettings(member.orgId), billingLink(member.orgId, member.billingRole ?? member.role), logo.current(member.orgId)]);
  return { role: member.role, settings, billingLink: billingLinked, logoPath: logoPath ?? "" };
}
