"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { TextInput } from "@/components/ui/text-input";
import { DEFAULT_INVITE_ROLE, ROLES, ROLE_LABELS } from "@/domain/members";
import { INVITE_MESSAGES, type InviteFormState } from "./state";

type Props = { action: (state: InviteFormState, formData: FormData) => Promise<InviteFormState> };

/** The invite form's presentational half: the fields, the button and the outcome of the last attempt (members-page S2). */
export function InviteFields({ state, pending, formAction }: { state: InviteFormState; pending?: boolean; formAction?: (formData: FormData) => void }) {
  const failed = state.status !== "idle" && state.status !== "sent";
  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-panel border border-hairline bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="inline-flex size-10 shrink-0 items-center justify-center rounded-control bg-action-tint text-action">
          <Icon name="plus" />
        </span>
        <div className="flex flex-col">
          <h2 className="font-display text-[18px] leading-tight font-semibold tracking-tight">Invite someone</h2>
          <p className="text-[13px] text-ink-2">They get an email with a link to join. No password needed.</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <TextInput id="invite-email" name="email" type="email" label="Email" autoComplete="off" required className="sm:flex-1" />
        <Select id="invite-role" name="role" label="Role" defaultValue={DEFAULT_INVITE_ROLE} className="sm:w-44">
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Sending…" : "Send invitation"}
        </Button>
      </div>
      {state.status !== "idle" && (
        <p role={failed ? "alert" : "status"} className={`text-[13px] font-medium ${failed ? "text-danger" : "text-ink"}`}>
          {INVITE_MESSAGES[state.status](state.email)}
        </p>
      )}
    </form>
  );
}

export function InviteForm({ action }: Props) {
  const [state, formAction, pending] = useActionState<InviteFormState, FormData>(action, { status: "idle" });
  return <InviteFields state={state} pending={pending} formAction={formAction} />;
}
