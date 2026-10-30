import type { ContractStatus } from "../contract";
import { isUuid } from "../imports";
import { pipelineStage, STAGE_LABELS, type PipelineStage } from "../pipeline";
import type { DomainEvent, TransitionErrorCode, TransitionResult } from "../transition";
import { isVisitMonths } from "./cadence";

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

/** As the form sends it: `visitMonths` and `assetTypeIds` are every checked box's value (cadence door 1, 2). */
export type ServiceLineInput = { description: string; visitMonths: string[]; costPerVisit: string; assetTypeIds: string[] };
/** Visits per year is not typed: it is the number of `visitMonths` (cadence AC 2). */
export type ServiceLineValue = { description: string; visitMonths: number[]; costPerVisitCents: number; assetTypeIds: string[] };
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
  const visitMonths = [...new Set(input.visitMonths.map((month) => (/^\d{1,2}$/.test(month) ? Number(month) : NaN)))].sort((a, b) => a - b);
  if (visitMonths.length === 0 || visitMonths.some((month) => !(month >= 1 && month <= 12))) {
    errors.visitMonths = "Choose at least one visit month";
  }
  const costPerVisitCents = parseCents(input.costPerVisit);
  if (costPerVisitCents === null || costPerVisitCents > MAX_COST_CENTS) {
    errors.costPerVisit = "Enter a cost per visit from $0 to $999,999.99";
  }
  const assetTypeIds = [...new Set(input.assetTypeIds)];
  if (assetTypeIds.length === 0 || !assetTypeIds.every(isUuid)) errors.assetTypeIds = "Choose at least one equipment type";
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, value: { description, visitMonths, costPerVisitCents: costPerVisitCents as number, assetTypeIds } };
}

/** The stage label, or why an agreement has no stage: withdrawn, or its contract voided. */
export function labelFor(stage: PipelineStage | null, status: AgreementStatus): string {
  if (stage) return STAGE_LABELS[stage];
  return status === "withdrawn" ? "Withdrawn" : "Contract voided";
}

export function statusLabel(status: AgreementStatus, contract?: ContractStatus | null): string {
  return labelFor(pipelineStage(status, contract), status);
}

/** One equipment type of a service scope: its checklist and its assets on the site (service-included door 1). */
export type ScopeAsset = { unitNo: string | null; typeModel: string | null; location: string | null };
/** A checklist task: `visitMonths` are the months of the visits it applies at, `null` for every visit (seasonal-tasks door 1). */
export type ScopeTask = { description: string; visitMonths: number[] | null };
export type ScopeType = { code: string; name: string; tasks: ScopeTask[]; assets: ScopeAsset[] };
/** What an agreement covers; `takenAt` (ISO timestamp) is when a frozen version recorded it, `null` for a live scope. */
export type ServiceScope = { takenAt: string | null; types: ScopeType[] };

const compareText = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown): value is string => typeof value === "string";
const isOptionalText = (value: unknown): value is string | null => value === null || typeof value === "string";

function parseAsset(value: unknown): ScopeAsset | null {
  if (!isRecord(value) || !isOptionalText(value.unitNo) || !isOptionalText(value.typeModel) || !isOptionalText(value.location)) return null;
  return { unitNo: value.unitNo, typeModel: value.typeModel, location: value.location };
}

/** Schema 1 holds tasks as text, for every visit; schema 2 as `{description, visitMonths}` (seasonal-tasks door 2). */
function parseTask(value: unknown, schema: 1 | 2): ScopeTask | null {
  if (schema === 1) return isText(value) ? { description: value, visitMonths: null } : null;
  if (!isRecord(value) || !isText(value.description) || !("visitMonths" in value)) return null;
  if (value.visitMonths !== null && !isVisitMonths(value.visitMonths)) return null;
  return { description: value.description, visitMonths: value.visitMonths === null ? null : [...value.visitMonths] };
}

function parseType(value: unknown, schema: 1 | 2): ScopeType | null {
  if (!isRecord(value) || !isText(value.code) || !isText(value.name)) return null;
  if (!Array.isArray(value.tasks)) return null;
  const tasks = value.tasks.map((task) => parseTask(task, schema));
  if (tasks.some((task) => task === null)) return null;
  if (!Array.isArray(value.assets)) return null;
  const assets = value.assets.map(parseAsset);
  if (assets.some((asset) => asset === null)) return null;
  return { code: value.code, name: value.name, tasks: tasks as ScopeTask[], assets: assets as ScopeAsset[] };
}

/**
 * A stored or live scope document (`schema` 1 or 2) as types by name and units compared as numbers, no unit last, the
 * order of the site register. `null` for anything else, `{}` included.
 */
export function parseServiceScope(document: unknown): ServiceScope | null {
  if (!isRecord(document) || (document.schema !== 1 && document.schema !== 2) || !Array.isArray(document.types)) return null;
  const schema = document.schema;
  let takenAt: string | null = null;
  if (document.takenAt !== undefined) {
    if (!isText(document.takenAt) || Number.isNaN(Date.parse(document.takenAt))) return null;
    takenAt = document.takenAt;
  }
  const types = document.types.map((type) => parseType(type, schema));
  if (types.some((type) => type === null)) return null;
  const ordered = (types as ScopeType[]).map((type) => ({
    ...type,
    assets: [...type.assets].sort((a, b) => {
      if (a.unitNo === null || b.unitNo === null) return a.unitNo === b.unitNo ? 0 : a.unitNo === null ? 1 : -1;
      return compareText(a.unitNo, b.unitNo);
    }),
  }));
  return { takenAt, types: ordered.sort((a, b) => compareText(a.name, b.name)) };
}

/** The six default terms a version carries once it has left draft (customer-portal door 3). */
export type AgreementTerms = {
  repairDiscountPct: number;
  cpiCapPct: number;
  cancellationNoticeDays: number | null;
  paymentDays: number | null;
  governingProvince: string | null;
  taxNote: string | null;
};

const isPercent = (value: unknown): value is number => typeof value === "number" && value >= 0 && value <= 100;
const isOptionalDays = (value: unknown): value is number | null => value === null || (typeof value === "number" && Number.isInteger(value) && value >= 0);

/** The `terms` of a stored snapshot, or `null` when it has none or they are malformed. */
export function parseTerms(snapshot: unknown): AgreementTerms | null {
  if (!isRecord(snapshot) || !isRecord(snapshot.terms)) return null;
  const terms = snapshot.terms;
  if (
    !isPercent(terms.repairDiscountPct) ||
    !isPercent(terms.cpiCapPct) ||
    !isOptionalDays(terms.cancellationNoticeDays) ||
    !isOptionalDays(terms.paymentDays) ||
    !isOptionalText(terms.governingProvince) ||
    !isOptionalText(terms.taxNote)
  ) {
    return null;
  }
  return {
    repairDiscountPct: terms.repairDiscountPct,
    cpiCapPct: terms.cpiCapPct,
    cancellationNoticeDays: terms.cancellationNoticeDays,
    paymentDays: terms.paymentDays,
    governingProvince: terms.governingProvince,
    taxNote: terms.taxNote,
  };
}

export * from "./cadence";
export * from "./document";
