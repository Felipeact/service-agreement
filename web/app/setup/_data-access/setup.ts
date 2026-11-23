import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { groupSetupCatalog, setupEntry } from "@/domain/org-settings/setup";

/**
 * What the first-login setup screen reads: who is asking, whether their org's setup is pending, and what the screen shows.
 * Signed out goes to /login; a member with nothing to set up, or without the role to do it, goes to the Pipeline.
 */
export async function loadSetup() {
  const { currentMember, setupPending, getOrgSettings, setupCatalog, getItemWords, logo } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect(member.status === "signed_out" ? "/login" : "/pipeline");

  const entry = setupEntry({ status: "member", role: member.role }, await setupPending(member.orgId));
  if (entry.to !== "render") redirect(entry.to);

  const [settings, types, words, logoPath] = await Promise.all([getOrgSettings(member.orgId), setupCatalog(), getItemWords(member.orgId), logo.current(member.orgId)]);
  if (!settings) redirect("/pipeline");
  return { settings, groups: groupSetupCatalog(types, words), words, logoPath: logoPath ?? "" };
}
