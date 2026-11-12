import type { TransitionResult } from "../transition";

/** Same values as the `contracts.status` check in the init migration. */
export const CONTRACT_STATUSES = ["pending_signature", "client_signed", "completed", "declined", "voided"] as const;

export type ContractStatus = (typeof CONTRACT_STATUSES)[number];

export type ContractCommand = { type: "client_sign" | "countersign" | "decline" | "void" };

const OPEN: readonly ContractStatus[] = ["pending_signature", "client_signed"];

/** The client signs first, then the tenant countersigns. */
const TRANSITIONS: Record<ContractCommand["type"], { from: readonly ContractStatus[]; to: ContractStatus }> = {
  client_sign: { from: ["pending_signature"], to: "client_signed" },
  countersign: { from: ["client_signed"], to: "completed" },
  decline: { from: OPEN, to: "declined" },
  void: { from: OPEN, to: "voided" },
};

export function applyContractCommand(
  status: ContractStatus,
  command: ContractCommand,
): TransitionResult<ContractStatus> {
  const transition = TRANSITIONS[command.type];
  if (!transition.from.includes(status)) {
    return { ok: false, error: { code: "invalid_transition", from: status, command: command.type } };
  }
  return {
    ok: true,
    status: transition.to,
    event: { type: `contract.${transition.to}`, entityType: "contract", from: status, to: transition.to, data: {} },
  };
}

/** What staff read for each status, and whether it needs attention: the contract is still open, or it is over. */
export const CONTRACT_STATUS_META: Record<ContractStatus, { label: string; tone: "attention" | "neutral" }> = {
  pending_signature: { label: "Pending signature", tone: "attention" },
  client_signed: { label: "Client signed", tone: "attention" },
  completed: { label: "Completed", tone: "neutral" },
  declined: { label: "Declined", tone: "neutral" },
  voided: { label: "Voided", tone: "neutral" },
};

export * from "./parties";
export * from "./document";
export * from "./template";
export * from "./signing";
export * from "./webhook";
