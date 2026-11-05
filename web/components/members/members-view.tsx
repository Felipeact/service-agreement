import type { InvitationRow, MemberRole, MemberRow } from "@/application/ports";
import { PageHeader } from "@/components/shell/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { ROLE_LABELS, isExpired } from "@/domain/members";
import { InvitationControls } from "./invitation-controls";
import { InviteForm } from "./invite-form";
import { RemoveControl, RoleForm } from "./member-controls";
import { canManageMembers, type InviteFormState, type RemoveFormState, type RevokeFormState, type SetRoleFormState } from "./state";

const date = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeZone: "America/Vancouver" });

type Props = {
  members: MemberRow[];
  /** `null` for a member who may not see them (estimator, viewer). */
  invitations: InvitationRow[] | null;
  currentUserId: string;
  role: MemberRole;
  orgName: string;
  now: Date;
  actions: {
    invite: (state: InviteFormState, formData: FormData) => Promise<InviteFormState>;
    revoke: (state: RevokeFormState, formData: FormData) => Promise<RevokeFormState>;
    setRole: (state: SetRoleFormState, formData: FormData) => Promise<SetRoleFormState>;
    remove: (state: RemoveFormState, formData: FormData) => Promise<RemoveFormState>;
  };
};

/** The Members page body: who is in the org, and for owners and admins the invitations and every control (members-page S1-S4). */
export function MembersView({ members, invitations, currentUserId, role, orgName, now, actions }: Props) {
  const manage = canManageMembers(role);
  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Members" />
      {manage && <InviteForm action={actions.invite} />}

      <section aria-label="Members" className="flex flex-col gap-2">
        <h2 className="text-[13px] font-semibold">People in {orgName}</h2>
        <ul className="flex flex-col divide-y divide-hairline rounded-panel border border-hairline bg-surface">
          {members.map((member) => {
            const own = member.userId === currentUserId;
            return (
              <li key={member.userId} data-member={member.userId} className="flex flex-col gap-3 px-4 py-3 text-[13px]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-0 font-semibold break-all">{member.email}</span>
                  {own && <StatusPill tone="neutral" label="You" />}
                  <span className="text-ink-2">{ROLE_LABELS[member.role]}</span>
                  <span className="text-ink-2">{`Joined ${date.format(member.joinedAt)}`}</span>
                </div>
                {manage && !own && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6">
                    <RoleForm member={member} action={actions.setRole} />
                    <RemoveControl member={member} orgName={orgName} action={actions.remove} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {manage && invitations && (
        <section aria-label="Pending invitations" className="flex flex-col gap-2">
          <h2 className="text-[13px] font-semibold">Pending invitations</h2>
          {invitations.length === 0 ? (
            <p className="text-[13px] text-ink-2">No pending invitations.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-hairline rounded-panel border border-hairline bg-surface">
              {invitations.map((invitation) => (
                <li key={invitation.id} data-invitation={invitation.id} className="flex flex-col gap-3 px-4 py-3 text-[13px]">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="min-w-0 font-semibold break-all">{invitation.email}</span>
                    <span className="text-ink-2">{ROLE_LABELS[invitation.role]}</span>
                    <span className="text-ink-2">{`Invited ${date.format(invitation.invitedAt)}`}</span>
                    {isExpired(invitation.expiresAt, now) ? (
                      <StatusPill tone="attention" label="Expired" />
                    ) : (
                      <span className="text-ink-2">{`Expires ${date.format(invitation.expiresAt)}`}</span>
                    )}
                  </div>
                  <InvitationControls invitation={invitation} resend={actions.invite} revoke={actions.revoke} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
