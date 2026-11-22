"use client";

import { useActionState } from "react";
import type { InvitationRow } from "@/application/ports";
import { Button } from "@/components/ui/button";
import { INVITE_MESSAGES, REVOKE_MESSAGES, type InviteFormState, type RevokeFormState } from "./state";

type ResendAction = (state: InviteFormState, formData: FormData) => Promise<InviteFormState>;
type RevokeAction = (state: RevokeFormState, formData: FormData) => Promise<RevokeFormState>;

/**
 * Resend submits the row's own address and role to the invite action, which refreshes a live invitation (members-page
 * AC 14); Revoke submits its id (AC 15). Revoke asks nothing: inviting again undoes it.
 */
export function InvitationControls({ invitation, resend, revoke }: { invitation: InvitationRow; resend: ResendAction; revoke: RevokeAction }) {
  const [resent, resendAction, resending] = useActionState<InviteFormState, FormData>(resend, { status: "idle" });
  const [revoked, revokeAction, revoking] = useActionState<RevokeFormState, FormData>(revoke, { status: "idle" });
  const resendFailed = resent.status !== "idle" && resent.status !== "sent";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <form action={resendAction}>
          <input type="hidden" name="email" value={invitation.email} />
          <input type="hidden" name="role" value={invitation.role} />
          <Button type="submit" disabled={resending}>
            {resending ? "Sending…" : "Resend"}
          </Button>
        </form>
        <form action={revokeAction}>
          <input type="hidden" name="invitationId" value={invitation.id} />
          <Button type="submit" disabled={revoking}>
            {revoking ? "Revoking…" : "Revoke"}
          </Button>
        </form>
      </div>
      {resent.status !== "idle" && (
        <p role={resendFailed ? "alert" : "status"} className={`text-[13px] font-medium ${resendFailed ? "text-danger" : "text-ink"}`}>
          {INVITE_MESSAGES[resent.status](resent.email)}
        </p>
      )}
      {revoked.status !== "idle" && (
        <p role={revoked.status === "revoked" ? "status" : "alert"} className={`text-[13px] font-medium ${revoked.status === "revoked" ? "text-ink" : "text-danger"}`}>
          {REVOKE_MESSAGES[revoked.status]}
        </p>
      )}
    </div>
  );
}
