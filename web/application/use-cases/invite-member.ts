import type { InvitationLinkSender, MemberAdmin } from "@/application/ports";
import { validateInvitation, type InvitationInput } from "@/domain/members";

export type InviteState = "sent" | "invalid" | "already_member" | "owner_only" | "rate_limited" | "saved_not_sent" | "forbidden" | "unavailable";

/** `email` is the address as stored (trimmed, lowercased) once it is valid, else what was typed, trimmed. */
export type InviteOutcome = { status: InviteState; email: string };

/**
 * Stores the invitation, then asks for the sign-in link. A link that fails leaves the invitation in place, so Resend
 * is the same call again (members-page S2).
 */
export function makeInviteMember(admin: Pick<MemberAdmin, "invite">, sender: InvitationLinkSender) {
  return async function inviteMember(input: InvitationInput): Promise<InviteOutcome> {
    const checked = validateInvitation(input);
    if (!checked.ok) return { status: "invalid", email: input.email.trim() };
    const { email, role } = checked.value;

    const stored = await admin.invite(email, role);
    if (!stored.ok) return { status: stored.code, email };

    const sent = await sender.send(email);
    if (sent.ok) return { status: "sent", email };
    return { status: sent.code === "rate_limited" ? "rate_limited" : "saved_not_sent", email };
  };
}
