import type { DomainEvent, TransitionErrorCode, TransitionResult } from "../transition";

/** Same values as the `agreements.status` check in the init migration. */
export const AGREEMENT_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "refused",
  "changes_requested",
  "expired",
  "withdrawn",
] as const;

export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

export type AgreementCommand =
  | { type: "send" }
  | { type: "accept" }
  | { type: "refuse"; reason: string }
  | { type: "request_changes"; reason: string }
  /** `versionNo` is the current version; the new draft is `versionNo + 1`. */
  | { type: "revise"; versionNo: number }
  | { type: "expire" }
  | { type: "withdraw" };

export const MAX_REASON_LENGTH = 2000;

const TRANSITIONS: Record<AgreementCommand["type"], { from: readonly AgreementStatus[]; to: AgreementStatus }> = {
  send: { from: ["draft"], to: "sent" },
  accept: { from: ["sent"], to: "accepted" },
  refuse: { from: ["sent"], to: "refused" },
  request_changes: { from: ["sent"], to: "changes_requested" },
  revise: { from: ["changes_requested"], to: "draft" },
  expire: { from: ["sent"], to: "expired" },
  withdraw: { from: ["draft", "sent"], to: "withdrawn" },
};

const EVENT_TYPES: Record<AgreementCommand["type"], string> = {
  send: "agreement.sent",
  accept: "agreement.accepted",
  refuse: "agreement.refused",
  request_changes: "agreement.changes_requested",
  revise: "agreement.revised",
  expire: "agreement.expired",
  withdraw: "agreement.withdrawn",
};

export function applyAgreementCommand(
  status: AgreementStatus,
  command: AgreementCommand,
): TransitionResult<AgreementStatus> {
  const fail = (code: TransitionErrorCode): TransitionResult<AgreementStatus> => ({
    ok: false,
    error: { code, from: status, command: command.type },
  });

  const transition = TRANSITIONS[command.type];
  if (!transition.from.includes(status)) return fail("invalid_transition");

  let data: DomainEvent["data"] = {};
  if (command.type === "refuse" || command.type === "request_changes") {
    const reason = command.reason.trim();
    if (reason === "") return fail("reason_required");
    if (reason.length > MAX_REASON_LENGTH) return fail("reason_too_long");
    data = { reason };
  } else if (command.type === "revise") {
    data = { versionNo: command.versionNo + 1 };
  }

  return {
    ok: true,
    status: transition.to,
    event: { type: EVENT_TYPES[command.type], entityType: "agreement", from: status, to: transition.to, data },
  };
}
