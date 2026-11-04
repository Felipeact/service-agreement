"use client";

import { useActionState, useState } from "react";
import type { MemberRow } from "@/application/ports";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ROLES, ROLE_LABELS } from "@/domain/members";
import { REMOVE_MESSAGES, SET_ROLE_MESSAGES, type RemoveFormState, type SetRoleFormState } from "./state";

type SetRoleAction = (state: SetRoleFormState, formData: FormData) => Promise<SetRoleFormState>;
type RemoveAction = (state: RemoveFormState, formData: FormData) => Promise<RemoveFormState>;

function Outcome({ ok, message }: { ok: boolean; message: string }) {
  return (
    <p role={ok ? "status" : "alert"} className={`text-[13px] font-medium ${ok ? "text-ink" : "text-danger"}`}>
      {message}
    </p>
  );
}

/** A role picker with a Save button: a form, so it works by touch and without hover (members-page S4). */
export function RoleFields({ member, state, pending, formAction }: { member: MemberRow; state: SetRoleFormState; pending?: boolean; formAction?: (formData: FormData) => void }) {
  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <input type="hidden" name="userId" value={member.userId} />
      <Select id={`role-${member.userId}`} name="role" label="Role" defaultValue={member.role} className="sm:w-40">
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </Select>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save role"}
      </Button>
      {state.status !== "idle" && <Outcome ok={state.status === "saved"} message={SET_ROLE_MESSAGES[state.status]} />}
    </form>
  );
}

export function RoleForm({ member, action }: { member: MemberRow; action: SetRoleAction }) {
  const [state, formAction, pending] = useActionState<SetRoleFormState, FormData>(action, { status: "idle" });
  return <RoleFields member={member} state={state} pending={pending} formAction={formAction} />;
}

type PromptProps = {
  member: MemberRow;
  orgName: string;
  confirming: boolean;
  pending: boolean;
  state: RemoveFormState;
  onStart?: () => void;
  onCancel?: () => void;
  action?: (formData: FormData) => void;
};

/** Two steps, as `DeactivatePrompt`: the first button only asks, and nothing changes until Confirm (members-page AC 32). */
export function RemovePrompt({ member, orgName, confirming, pending, state, onStart, onCancel, action }: PromptProps) {
  return (
    <div className="flex flex-col gap-2">
      {confirming ? (
        <form action={action} className="flex flex-col gap-2">
          <input type="hidden" name="userId" value={member.userId} />
          <p className="text-[13px] font-medium text-ink">{`Remove ${member.email}?`}</p>
          <p className="text-[13px] text-ink-2">{`They lose access to ${orgName} immediately. What they created stays.`}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Removing…" : "Confirm remove"}
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div>
          <Button onClick={onStart}>Remove</Button>
        </div>
      )}
      {state.status !== "idle" && <Outcome ok={state.status === "removed"} message={REMOVE_MESSAGES[state.status]} />}
    </div>
  );
}

export function RemoveControl({ member, orgName, action }: { member: MemberRow; orgName: string; action: RemoveAction }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<RemoveFormState, FormData>(action, { status: "idle" });
  return (
    <RemovePrompt
      member={member}
      orgName={orgName}
      confirming={confirming}
      pending={pending}
      state={state}
      onStart={() => setConfirming(true)}
      onCancel={() => setConfirming(false)}
      action={formAction}
    />
  );
}
