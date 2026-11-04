"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getContainer } from "@/composition";
import { isRole } from "@/domain/members";
import {
  canManageMembers,
  type InviteFormState,
  type RemoveFormState,
  type RevokeFormState,
  type SetRoleFormState,
} from "@/components/members/state";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

/** The signed-in member, or a redirect to sign in. The org is the member's own: no action reads one from the form (AD-029). */
async function signedInMember() {
  const container = await getContainer();
  const member = await container.currentMember();
  if (member.status !== "member") redirect("/login");
  return { container, member };
}

/** Invites an address, or refreshes its live invitation: Resend submits this action too (members-page AC 10, 14). */
export async function inviteMemberAction(_state: InviteFormState, formData: FormData): Promise<InviteFormState> {
  const { container, member } = await signedInMember();
  const email = text(formData, "email");
  if (!canManageMembers(member.role)) return { status: "forbidden", email: email.trim() };
  const outcome = await container.inviteMember({ email, role: text(formData, "role") });
  revalidatePath("/members");
  return outcome;
}

export async function revokeInvitationAction(_state: RevokeFormState, formData: FormData): Promise<RevokeFormState> {
  const { container, member } = await signedInMember();
  if (!canManageMembers(member.role)) return { status: "forbidden" };
  const revoked = await container.revokeInvitation(text(formData, "invitationId"));
  revalidatePath("/members");
  return { status: revoked.ok ? "revoked" : revoked.code };
}

export async function setMemberRoleAction(_state: SetRoleFormState, formData: FormData): Promise<SetRoleFormState> {
  const { container, member } = await signedInMember();
  if (!canManageMembers(member.role)) return { status: "forbidden" };
  const role = text(formData, "role");
  if (!isRole(role)) return { status: "unavailable" };
  const changed = await container.setMemberRole(text(formData, "userId"), role);
  revalidatePath("/members");
  return { status: changed.ok ? "saved" : changed.code };
}

export async function removeMemberAction(_state: RemoveFormState, formData: FormData): Promise<RemoveFormState> {
  const { container, member } = await signedInMember();
  if (!canManageMembers(member.role)) return { status: "forbidden" };
  const removed = await container.removeMember(text(formData, "userId"));
  revalidatePath("/members");
  return { status: removed.ok ? "removed" : removed.code };
}
