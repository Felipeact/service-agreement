import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { canManageMembers } from "../_components/state";

/**
 * What the Members page reads: the roster for every member, and for owners and admins the pending invitations
 * (members-page AC 1, 3, 5). Signed out goes to /login.
 */
export async function loadMembers() {
  const { currentMember, listMembers, listInvitations, clock } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const [members, invitations] = await Promise.all([listMembers(), canManageMembers(member.role) ? listInvitations() : Promise.resolve(null)]);
  return { members, invitations, currentUserId: member.userId, role: member.role, orgName: member.orgName, now: clock.now() };
}
