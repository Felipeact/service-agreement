import { notFound, redirect } from "next/navigation";
import { getContainer } from "@/composition";

/** What the site page reads: the member's role and the site register (assets and live agreement). Signed out goes to /login; a missing or foreign id is a 404. */
export async function loadSite(siteId: string) {
  const { currentMember, siteRegister } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const site = await siteRegister(siteId);
  if (!site) notFound();
  return { role: member.role, site };
}
