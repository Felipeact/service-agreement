import type { Metadata } from "next";
import { inviteMemberAction, removeMemberAction, revokeInvitationAction, setMemberRoleAction } from "./actions";
import { MembersView } from "./_components/content";
import { loadMembers } from "./_data-access/members";

export const metadata: Metadata = { title: "Members" };

/** Every member sees the roster; owners and admins also read the pending invitations (members-page AC 1, 3, 5). */
export async function MembersForRequest() {
  const members = await loadMembers();
  return <MembersView {...members} actions={{ invite: inviteMemberAction, revoke: revokeInvitationAction, setRole: setMemberRoleAction, remove: removeMemberAction }} />;
}

export default async function MembersPage() {
  return <MembersForRequest />;
}
