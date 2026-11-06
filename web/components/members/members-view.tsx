import type { ReactNode } from "react";
import type { InvitationRow, MemberRole, MemberRow } from "@/application/ports";
import { PageHeader } from "@/components/shell/page-header";
import { Icon, type IconName } from "@/components/ui/icons";
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

/** One summary card: a small label with its icon over a big figure and a line of context. */
function Stat({ label, icon, value, note }: { label: string; icon: IconName; value: number; note: string }) {
  return (
    <div className="flex flex-col gap-2.5 rounded-panel border border-hairline bg-surface p-5 shadow-card">
      <div className="flex items-center justify-between text-ink-2">
        <span className="text-[13px] font-medium">{label}</span>
        <Icon name={icon} className="size-[18px]" />
      </div>
      <span className="font-display text-[30px] leading-none font-medium tracking-tight text-ink">{value}</span>
      <span className="text-[12px] text-ink-2">{note}</span>
    </div>
  );
}

/** A role as a small pill; the owner stands out in Action Tint, every other role is neutral. */
function RolePill({ role }: { role: MemberRole }) {
  return (
    <span
      data-role={role}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] leading-4 font-semibold ${role === "owner" ? "bg-action-tint text-action" : "bg-board text-ink-2"}`}
    >
      {ROLE_LABELS[role]}
    </span>
  );
}

/** A round tile with the first two letters of an email, standing in for a photo. */
function Avatar({ email, icon }: { email: string; icon?: IconName }) {
  return (
    <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-board font-display text-[13px] font-semibold text-ink-nav">
      {icon ? <Icon name={icon} className="size-[18px]" /> : email.slice(0, 2).toUpperCase()}
    </span>
  );
}

/** A panel of rows, each a person or an invitation, on the Card shadow. */
function Rows({ children }: { children: ReactNode }) {
  return <ul className="flex flex-col divide-y divide-hairline overflow-hidden rounded-panel border border-hairline bg-surface shadow-card">{children}</ul>;
}

/** The Members page body: who is in the org, and for owners and admins the invitations and every control (members-page S1-S4). */
export function MembersView({ members, invitations, currentUserId, role, orgName, now, actions }: Props) {
  const manage = canManageMembers(role);
  const leaders = members.filter((member) => member.role === "owner" || member.role === "admin").length;
  const pending = invitations?.length ?? 0;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Members" subtitle={`Everyone with access to ${orgName}, and what each of them can do.`} />

      <div className={`grid gap-3 lg:gap-4 ${manage && invitations ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-2"}`}>
        <Stat label="Members" icon="people" value={members.length} note={`In ${orgName}`} />
        <Stat label="Owners and admins" icon="gear" value={leaders} note="Can change settings and people" />
        {manage && invitations && <Stat label="Pending invitations" icon="mail" value={pending} note="Sent, not yet accepted" />}
      </div>

      {manage && <InviteForm action={actions.invite} />}

      <section aria-label="Members" className="flex flex-col gap-3">
        <h2 className="font-display text-[18px] font-semibold tracking-tight">People in {orgName}</h2>
        <Rows>
          {members.map((member) => {
            const own = member.userId === currentUserId;
            return (
              <li key={member.userId} data-member={member.userId} className="flex flex-col gap-3 px-5 py-4 text-[13px]">
                <div className="flex items-center gap-3">
                  <Avatar email={member.email} />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="min-w-0 font-semibold break-all">{member.email}</span>
                      {own && <StatusPill tone="neutral" label="You" />}
                    </span>
                    <span className="text-[12px] text-ink-2">{`Joined ${date.format(member.joinedAt)}`}</span>
                  </div>
                  <RolePill role={member.role} />
                </div>
                {manage && !own && (
                  <details className="group border-t border-hairline pt-1">
                    <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-action lg:min-h-9 [&::-webkit-details-marker]:hidden">
                      Manage
                      <Icon name="chevron" className="size-3.5 transition-transform duration-150 group-open:rotate-90" />
                    </summary>
                    <div className="flex flex-col gap-3 pt-2 pb-1 sm:flex-row sm:flex-wrap sm:items-end sm:gap-6">
                      <RoleForm member={member} action={actions.setRole} />
                      <RemoveControl member={member} orgName={orgName} action={actions.remove} />
                    </div>
                  </details>
                )}
              </li>
            );
          })}
        </Rows>
      </section>

      {manage && invitations && (
        <section aria-label="Pending invitations" className="flex flex-col gap-3">
          <h2 className="font-display text-[18px] font-semibold tracking-tight">Pending invitations</h2>
          {invitations.length === 0 ? (
            <p className="rounded-panel border border-dashed border-field bg-surface px-5 py-6 text-center text-[13px] text-ink-2">No pending invitations.</p>
          ) : (
            <Rows>
              {invitations.map((invitation) => (
                <li key={invitation.id} data-invitation={invitation.id} className="flex flex-col gap-3 px-5 py-4 text-[13px]">
                  <div className="flex items-center gap-3">
                    <Avatar email={invitation.email} icon="mail" />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="min-w-0 font-semibold break-all">{invitation.email}</span>
                      <span className="flex flex-wrap items-center gap-x-2 text-[12px] text-ink-2">
                        <span>{`Invited ${date.format(invitation.invitedAt)}`}</span>
                        {isExpired(invitation.expiresAt, now) ? (
                          <StatusPill tone="attention" label="Expired" />
                        ) : (
                          <span>{`Expires ${date.format(invitation.expiresAt)}`}</span>
                        )}
                      </span>
                    </div>
                    <RolePill role={invitation.role} />
                  </div>
                  <InvitationControls invitation={invitation} resend={actions.invite} revoke={actions.revoke} />
                </li>
              ))}
            </Rows>
          )}
        </section>
      )}
    </div>
  );
}
