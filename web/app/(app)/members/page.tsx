import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MembersView } from "@/components/members/members-view";
import { canManageMembers } from "@/components/members/state";
import { getContainer } from "@/composition";
import { inviteMemberAction, removeMemberAction, revokeInvitationAction, setMemberRoleAction } from "./actions";

export const metadata: Metadata = { title: "Members" };

/** Every member sees the roster; owners and admins also read the pending invitations (members-page AC 1, 3, 5). */
export async function MembersForRequest() {
  const { currentMember, listMembers, listInvitations, clock } = await getContainer();
  const member = await currentMember();
  if (member.status !== "member") redirect("/login");
  const manage = canManageMembers(member.role);
  const [members, invitations] = await Promise.all([listMembers(), manage ? listInvitations() : Promise.resolve(null)]);
  return (
    <MembersView
      members={members}
      invitations={invitations}
      currentUserId={member.userId}
      role={member.role}
      orgName={member.orgName}
      now={clock.now()}
      actions={{ invite: inviteMemberAction, revoke: revokeInvitationAction, setRole: setMemberRoleAction, remove: removeMemberAction }}
    />
  );
}

export default async function MembersPage() {
  return <MembersForRequest />;
}
