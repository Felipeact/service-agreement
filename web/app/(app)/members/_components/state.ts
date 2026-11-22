import type { MemberRole } from "@/application/ports";
import type { InviteState } from "@/application/use-cases";

/** What the invite form shows after a send attempt; `email` is the address as stored once it is valid. */
export type InviteFormState = { status: "idle" } | { status: InviteState; email: string };

export type RevokeFormState = { status: "idle" | "revoked" | "not_found" | "forbidden" | "unavailable" };
export type SetRoleFormState = { status: "idle" | "saved" | "owner_only" | "last_owner" | "self" | "not_found" | "forbidden" | "unavailable" };
export type RemoveFormState = { status: "idle" | "removed" | "owner_only" | "last_owner" | "self" | "not_found" | "forbidden" | "unavailable" };

/** Owners and admins manage members (the `list_invitations` and member functions check it again, door 4). */
export function canManageMembers(role: MemberRole): boolean {
  return role === "owner" || role === "admin";
}

export const UNAVAILABLE_MESSAGE = "Could not save. Try again.";

export const INVITE_MESSAGES: Record<InviteState, (email: string) => string> = {
  sent: (email) => `Invitation sent to ${email}`,
  invalid: () => "Enter a valid email address.",
  already_member: (email) => `${email} is already a member.`,
  owner_only: () => "Only an owner can invite an owner.",
  rate_limited: () => "Too many emails were sent. Try again in a minute.",
  saved_not_sent: () => "The invitation was saved, but the email could not be sent. Use Resend.",
  forbidden: () => "Only owners and admins can invite people.",
  unavailable: () => UNAVAILABLE_MESSAGE,
};

export const REVOKE_MESSAGES: Record<Exclude<RevokeFormState["status"], "idle">, string> = {
  revoked: "Invitation revoked.",
  not_found: "That invitation no longer exists.",
  forbidden: "Only owners and admins can revoke invitations.",
  unavailable: UNAVAILABLE_MESSAGE,
};

const CHANGE_REFUSALS = {
  owner_only: "Only an owner can change an owner.",
  last_owner: "An organization needs at least one owner.",
  self: "You can't change or remove yourself.",
  not_found: "That member was already removed.",
  forbidden: "Only owners and admins can change members.",
  unavailable: UNAVAILABLE_MESSAGE,
} as const;

export const SET_ROLE_MESSAGES: Record<Exclude<SetRoleFormState["status"], "idle">, string> = { saved: "Role updated.", ...CHANGE_REFUSALS };
export const REMOVE_MESSAGES: Record<Exclude<RemoveFormState["status"], "idle">, string> = { removed: "Member removed.", ...CHANGE_REFUSALS };
