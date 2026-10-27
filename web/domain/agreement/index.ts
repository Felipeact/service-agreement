import type { ContractStatus } from "../contract";
import { pipelineStage, STAGE_LABELS, type PipelineStage } from "../pipeline";
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

/** A site has at most one agreement in these statuses (agreement-builder door 2). */
export const LIVE_STATUSES: readonly AgreementStatus[] = ["draft", "sent", "changes_requested"];

/** The most lines one version holds (app-side; a race can reach one more). */
export const MAX_SERVICE_LINES = 50;

export type ServiceLineInput = { description: string; visitsPerYear: string; costPerVisit: string };
export type ServiceLineValue = { description: string; visitsPerYear: number; costPerVisitCents: number };
export type ServiceLineErrors = Partial<Record<keyof ServiceLineInput, string>>;

const MAX_DESCRIPTION = 200;
const MAX_COST_CENTS = 99_999_999;
/** Dollars with thousands commas grouped by three, or plain digits; at most two decimals. */
const DOLLARS = /^(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?$/;

/** Dollars as typed (`$1,234.5`) to integer cents, or `null` when it is not an amount. */
function parseCents(raw: string): number | null {
  const match = DOLLARS.exec(raw.trim().replace(/^\$/, ""));
  if (!match) return null;
  return Number(match[1].replaceAll(",", "")) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

/** Checks one service line as the form sends it; every bad field gets its own message. */
export function validateServiceLine(
  input: ServiceLineInput,
): { ok: true; value: ServiceLineValue } | { ok: false; errors: ServiceLineErrors } {
  const errors: ServiceLineErrors = {};
  const description = input.description.trim();
  if (description === "" || description.length > MAX_DESCRIPTION) {
    errors.description = `Enter a description of 1 to ${MAX_DESCRIPTION} characters`;
  }
  const visitsText = input.visitsPerYear.trim();
  const visitsPerYear = /^\d+$/.test(visitsText) ? Number(visitsText) : NaN;
  if (!(visitsPerYear >= 1 && visitsPerYear <= 365)) errors.visitsPerYear = "Enter visits per year as a whole number from 1 to 365";
  const costPerVisitCents = parseCents(input.costPerVisit);
  if (costPerVisitCents === null || costPerVisitCents > MAX_COST_CENTS) {
    errors.costPerVisit = "Enter a cost per visit from $0 to $999,999.99";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { description, visitsPerYear, costPerVisitCents: costPerVisitCents as number } };
}

/** The stage label, or why an agreement has no stage: withdrawn, or its contract voided. */
export function labelFor(stage: PipelineStage | null, status: AgreementStatus): string {
  if (stage) return STAGE_LABELS[stage];
  return status === "withdrawn" ? "Withdrawn" : "Contract voided";
}

export function statusLabel(status: AgreementStatus, contract?: ContractStatus | null): string {
  return labelFor(pipelineStage(status, contract), status);
}
