"use client";

import { useActionState, useState } from "react";
import type { LibraryType } from "@/domain/task-library";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import { TYPE_STATUS_MESSAGES, type TypeAction, type TypeActions, type TypeFormState } from "./state";

const IDLE: TypeFormState = { status: "idle" };

function TypeAlert({ state }: { state: TypeFormState }) {
  if (state.status === "idle") return null;
  return (
    <p role="alert" className="text-[13px] font-medium text-danger">
      {TYPE_STATUS_MESSAGES[state.status]}
    </p>
  );
}

type NameFormProps = { action: TypeAction; id: string; label: string; submit: string; typeCode?: string; initial: string };

/** One name field and its button; used to add a type and to rename one (type-editor S1, S2). */
function NameForm({ action, id, label, submit, typeCode, initial }: NameFormProps) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  const shown = state.status === "idle" ? initial : state.name;
  const error = state.status === "idle" ? undefined : TYPE_STATUS_MESSAGES[state.status];
  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      {typeCode && <input type="hidden" name="typeCode" value={typeCode} />}
      <TextInput id={id} name="name" label={label} defaultValue={shown} key={shown} error={error} className="min-w-0 flex-1" />
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? `${submit}…` : submit}
      </Button>
    </form>
  );
}

/** The Add form under the type list; the view shows it to owners and admins only. */
export function AddTypeForm({ action }: { action: TypeAction }) {
  return <NameForm action={action} id="newTypeName" label="New equipment type" submit="Add type" initial="" />;
}

type PromptProps = {
  name: string;
  typeCode: string;
  confirming: boolean;
  pending: boolean;
  state: TypeFormState;
  onStart?: () => void;
  onCancel?: () => void;
  action?: (formData: FormData) => void;
};

/** Two steps, as `DeactivatePrompt`: the first button only asks, and nothing is sent until the second is pressed (AC 11). */
export function RemoveTypePrompt({ name, typeCode, confirming, pending, state, onStart, onCancel, action }: PromptProps) {
  return (
    <section className="flex flex-col gap-3">
      {confirming ? (
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="typeCode" value={typeCode} />
          <p className="text-[13px] font-medium text-ink">{`Remove ${name} and its checklist?`}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="danger" disabled={pending}>
              {pending ? "Removing…" : "Remove"}
            </Button>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      ) : (
        <div>
          <Button onClick={onStart}>Remove type</Button>
        </div>
      )}
      <TypeAlert state={state} />
    </section>
  );
}

function RemoveType({ type, action }: { type: LibraryType; action: TypeAction }) {
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState(action, IDLE);
  return (
    <RemoveTypePrompt
      name={type.name}
      typeCode={type.code}
      confirming={confirming}
      pending={pending}
      state={state}
      onStart={() => setConfirming(true)}
      onCancel={() => setConfirming(false)}
      action={formAction}
    />
  );
}

function ResetType({ type, action }: { type: LibraryType; action: TypeAction }) {
  const [state, formAction, pending] = useActionState(action, IDLE);
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="typeCode" value={type.code} />
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Resetting…" : `Reset to ${type.pack} pack`}
        </Button>
      </div>
      <TypeAlert state={state} />
    </form>
  );
}

/** Rename, Reset (only for a type that has a pack) and Remove for the selected type. */
export function TypeControls({ type, actions }: { type: LibraryType; actions: TypeActions }) {
  return (
    <div className="flex flex-col gap-4 border-b border-hairline pb-4">
      <NameForm action={actions.rename} id="typeName" label="Name" submit="Rename" typeCode={type.code} initial={type.name} />
      <div className="flex flex-wrap items-start gap-6">
        {type.pack && <ResetType type={type} action={actions.reset} />}
        <RemoveType type={type} action={actions.remove} />
      </div>
    </div>
  );
}
