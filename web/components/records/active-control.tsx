"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatTermDate } from "@/domain/agreement/term";
import { FormAlert } from "./record-form";
import type { ActiveState } from "./state";

export type ActiveKind = "customer" | "site" | "asset";

/** Another active unit on the asset's site, offered as its replacement (deactivation AC 2). */
export type ReplacementOption = { id: string; label: string };

const START_LABEL: Record<ActiveKind, string> = {
  customer: "Deactivate customer",
  site: "Deactivate site",
  asset: "Remove from service",
};

/** Why a deactivation or reactivation was refused, in words; `null` for the states `FormAlert` covers. */
export function activeMessage(kind: ActiveKind, state: ActiveState): string | null {
  switch (state.status) {
    case "in_term": {
      const until = state.termEnd ? ` until ${formatTermDate(state.termEnd)}` : "";
      const text = `${state.number} is in term${until}, so this site can't be deactivated yet.`;
      return kind === "customer" ? `${state.site}: ${text}` : text;
    }
    case "changes_requested": {
      const text = `${state.number} has changes requested. Revise and withdraw it first.`;
      return kind === "customer" ? `${state.site}: ${text}` : text;
    }
    case "parent_inactive":
      return `Reactivate ${state.parent} first.`;
    case "invalid_replacement":
      return "Choose an active unit on this site as the replacement.";
    default:
      return null;
  }
}

function ActiveAlert({ kind, state }: { kind: ActiveKind; state: ActiveState }) {
  const message = activeMessage(kind, state);
  if (!message) return <FormAlert status={state.status} />;
  return (
    <p role="alert" className="text-[13px] font-medium text-danger">
      {message}
    </p>
  );
}

type PromptProps = {
  kind: ActiveKind;
  /** The record's name as the prompt names it: the customer, the site, or `RTU RTU-1`. */
  name: string;
  /** The live agreement a site deactivation withdraws, by number. */
  withdraws?: string | null;
  /** For an asset: the other active units on its site. */
  replacements?: ReplacementOption[];
  confirming: boolean;
  pending: boolean;
  state: ActiveState;
  onStart?: () => void;
  onCancel?: () => void;
  action?: (formData: FormData) => void;
};

/** Two steps, as `DeletePrompt`: the first button only asks, and nothing changes until the second is pressed. */
export function DeactivatePrompt({ kind, name, withdraws, replacements = [], confirming, pending, state, onStart, onCancel, action }: PromptProps) {
  const question = kind === "asset" ? `Remove ${name} from service?` : `Deactivate ${name}?`;
  const submit = kind === "asset" ? "Remove" : "Deactivate";
  return (
    <section className="flex max-w-xl flex-col gap-3 border-t border-hairline pt-5">
      {confirming ? (
        <form action={action} className="flex flex-col gap-3">
          <p className="text-[13px] font-medium text-ink">{question}</p>
          {kind === "site" && withdraws && <p className="text-[13px] text-ink-2">{`This withdraws ${withdraws}.`}</p>}
          {kind === "customer" && <p className="text-[13px] text-ink-2">Their sites are deactivated too, and each site&apos;s open agreement is withdrawn.</p>}
          {kind === "asset" && replacements.length > 0 && (
            <Select id="replacedBy" name="replacedBy" label="Replaced by" defaultValue="" className="max-w-xs">
              <option value="">None</option>
              {replacements.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? `${submit}…` : submit}
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div>
          <Button onClick={onStart}>{START_LABEL[kind]}</Button>
        </div>
      )}
      <ActiveAlert kind={kind} state={state} />
    </section>
  );
}

/** One step: reactivating is undone by deactivating again. */
export function ReactivatePrompt({ kind, pending, state, action }: { kind: ActiveKind; pending: boolean; state: ActiveState; action?: (formData: FormData) => void }) {
  return (
    <section className="flex max-w-xl flex-col gap-3 border-t border-hairline pt-5">
      <form action={action}>
        <Button type="submit" disabled={pending}>
          {pending ? "Reactivating…" : "Reactivate"}
        </Button>
      </form>
      <ActiveAlert kind={kind} state={state} />
    </section>
  );
}

type Action = (state: ActiveState, formData: FormData) => Promise<ActiveState>;

export function DeactivateControl(props: Omit<PromptProps, "confirming" | "pending" | "state" | "onStart" | "onCancel" | "action"> & { action: Action }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<ActiveState, FormData>(props.action, { status: "idle" });
  return (
    <DeactivatePrompt
      {...props}
      confirming={confirming}
      pending={pending}
      state={state}
      onStart={() => setConfirming(true)}
      onCancel={() => setConfirming(false)}
      action={formAction}
    />
  );
}

export function ReactivateControl({ kind, action }: { kind: ActiveKind; action: Action }) {
  const [state, formAction, pending] = useActionState<ActiveState, FormData>(action, { status: "idle" });
  return <ReactivatePrompt kind={kind} pending={pending} state={state} action={formAction} />;
}
