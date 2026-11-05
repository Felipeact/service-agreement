"use client";

import { useActionState, useState, type CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import type { PortalDecision } from "@/application/use-cases";
import { decideMessage, MAX_REASON, type DecideState } from "./state";

type Mode = "choose" | PortalDecision;

type DecisionControlsProps = {
  tenantName: string;
  /** The primary button's colours: the tenant's accent and the text that reads on it (AC 11, 12). */
  primary: CSSProperties;
  /** The Server Action, bound to the link's token. */
  decide: (decision: PortalDecision, reason: string) => Promise<DecideState>;
};

const REASON_LABEL = {
  refuse: "Why are you refusing this agreement?",
  request_changes: "What would you like changed?",
} as const;

const SUBMIT_LABEL = { accept: "Accept", refuse: "Refuse", request_changes: "Request changes" } as const;

const full = "w-full sm:w-auto";

type DecisionPanelProps = {
  mode: Mode;
  reason: string;
  state: DecideState;
  pending?: boolean;
  tenantName: string;
  primary: CSSProperties;
  onChoose?: (mode: Mode) => void;
  onReason?: (reason: string) => void;
  /** The form action; absent in tests that only render markup. */
  action?: () => void;
};

/** What the customer sees for one step of the decision; the state lives in `DecisionControls`. */
export function DecisionPanel({ mode, reason, state, pending = false, tenantName, primary, onChoose, onReason, action }: DecisionPanelProps) {
  const typed = reason.trim().length;
  const message = decideMessage(state, tenantName, typed);
  const reasonError = state.status === "reason_required" || state.status === "reason_too_long" ? message : null;

  if (mode === "choose") {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="primary" style={primary} className={full} onClick={() => onChoose?.("accept")}>
            Accept
          </Button>
          <Button className={full} onClick={() => onChoose?.("refuse")}>
            Refuse
          </Button>
          <Button className={full} onClick={() => onChoose?.("request_changes")}>
            Request changes
          </Button>
        </div>
        {!reasonError && message && (
          <p role="alert" className="text-[13px] font-medium text-danger">
            {message}
          </p>
        )}
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      {mode === "accept" ? (
        <p className="text-[15px] font-semibold">Accept this agreement?</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="reason" className="text-[13px] font-medium">
            {REASON_LABEL[mode]}
          </label>
          <textarea
            id="reason"
            name="reason"
            rows={4}
            value={reason}
            onChange={(event) => onReason?.(event.target.value)}
            aria-invalid={reasonError ? true : undefined}
            aria-describedby={reasonError ? "reason-error" : "reason-count"}
            className={`w-full rounded-control border bg-surface px-3 py-2 text-base text-ink sm:text-[13px] ${reasonError ? "border-danger" : "border-hairline"}`}
          />
          <p id="reason-count" className={`text-[12px] ${typed > MAX_REASON ? "font-medium text-danger" : "text-ink-2"}`}>
            {`${typed} of ${MAX_REASON} characters`}
          </p>
          {reasonError && (
            <p id="reason-error" role="alert" className="text-[13px] font-medium text-danger">
              {reasonError}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" variant="primary" style={primary} className={full} disabled={pending}>
          {SUBMIT_LABEL[mode]}
        </Button>
        <Button className={full} disabled={pending} onClick={() => onChoose?.("choose")}>
          Cancel
        </Button>
      </div>
      {!reasonError && message && (
        <p role="alert" className="text-[13px] font-medium text-danger">
          {message}
        </p>
      )}
    </form>
  );
}

/** Accept confirms first; Refuse and Request changes ask for a reason (customer-portal AC 17 to 22). */
export function DecisionControls({ tenantName, primary, decide }: DecisionControlsProps) {
  const [mode, setMode] = useState<Mode>("choose");
  const [reason, setReason] = useState("");
  const [state, submit, pending] = useActionState(
    (_previous: DecideState, answer: { decision: PortalDecision; reason: string }) => decide(answer.decision, answer.reason),
    { status: "idle" } as DecideState,
  );

  return (
    <DecisionPanel
      mode={mode}
      reason={reason}
      state={state}
      pending={pending}
      tenantName={tenantName}
      primary={primary}
      onChoose={(next) => {
        setMode(next);
        setReason("");
      }}
      onReason={setReason}
      action={() => {
        if (mode !== "choose") submit({ decision: mode, reason });
      }}
    />
  );
}
