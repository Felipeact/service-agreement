/**
 * Ask AI (assistant door 1): what a member may ask, what the model may answer, and the few things it may offer to do. The model
 * never acts: it proposes one action at most, the member confirms it, and it then runs through the same server action a button
 * on the page would call. Nothing here reads a clock, the database or the network.
 */

import { formatResetDate } from "../billing/plan-limits";

/** Questions one member may ask in any 24 hours (a burst guard; the plan sets the company's monthly total). */
export const DAILY_QUESTION_LIMIT = 30;
export const MAX_QUESTION_LENGTH = 500;
/** Earlier turns sent along so a follow-up makes sense. */
export const MAX_HISTORY_TURNS = 6;
export const MAX_ANSWER_LENGTH = 1500;

export type AssistantTurn = { role: "user" | "assistant"; text: string };

export type AssistantAction =
  | { kind: "open"; path: string; label: string }
  | { kind: "create_agreement"; siteId: string; label: string }
  | { kind: "generate_lines"; agreementId: string; label: string };

export type AssistantReply = { answer: string; action: AssistantAction | null };

export type QuestionCheck = { ok: true; question: string } | { ok: false; error: string };

export function validateQuestion(input: unknown): QuestionCheck {
  const question = typeof input === "string" ? input.trim() : "";
  if (question.length === 0) return { ok: false, error: "Type a question first." };
  if (question.length > MAX_QUESTION_LENGTH) return { ok: false, error: `Keep the question under ${MAX_QUESTION_LENGTH} characters.` };
  return { ok: true, question };
}

/** The earlier turns, kept to the last few and to well-formed ones; anything else is dropped. */
export function cleanHistory(input: unknown): AssistantTurn[] {
  if (!Array.isArray(input)) return [];
  const turns: AssistantTurn[] = [];
  for (const raw of input) {
    const turn = raw as Partial<AssistantTurn> | null;
    if (turn && (turn.role === "user" || turn.role === "assistant") && typeof turn.text === "string" && turn.text.trim() !== "") {
      turns.push({ role: turn.role, text: turn.text.slice(0, turn.role === "user" ? MAX_QUESTION_LENGTH : MAX_ANSWER_LENGTH) });
    }
  }
  return turns.slice(-MAX_HISTORY_TURNS);
}

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** The pages the assistant may send a member to: a list page, or one record by id. Nothing else, so a link is never made up. */
const OPEN_PATH = new RegExp(`^/(pipeline|agreements|customers|sites|templates|imports|reports|search|members|settings|settings/billing|agreements/${UUID}|customers/${UUID}|sites/${UUID})$`);

export const isOpenablePath = (path: string): boolean => OPEN_PATH.test(path);

/** The ids the model was shown; it may only point at those. */
export type KnownIds = { siteIds: ReadonlySet<string>; agreementIds: ReadonlySet<string> };

/** The model's JSON answer as a reply, or `null` when it is not the shape asked for. An action the member may not take or that names an unknown id is dropped; the answer stays. */
export function readReply(text: string, known: KnownIds, canAct: boolean): AssistantReply | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const { answer, actionKind, actionTarget, actionLabel } = (raw ?? {}) as Record<string, unknown>;
  if (typeof answer !== "string" || answer.trim() === "") return null;
  const reply: AssistantReply = { answer: answer.trim().slice(0, MAX_ANSWER_LENGTH), action: null };
  if (typeof actionKind !== "string" || typeof actionTarget !== "string") return reply;
  const label = typeof actionLabel === "string" && actionLabel.trim() !== "" ? actionLabel.trim().slice(0, 60) : "Go";
  if (actionKind === "open" && isOpenablePath(actionTarget)) reply.action = { kind: "open", path: actionTarget, label };
  else if (canAct && actionKind === "create_agreement" && known.siteIds.has(actionTarget)) reply.action = { kind: "create_agreement", siteId: actionTarget, label };
  else if (canAct && actionKind === "generate_lines" && known.agreementIds.has(actionTarget)) reply.action = { kind: "generate_lines", agreementId: actionTarget, label };
  return reply;
}

export const LIMIT_MESSAGE = `You have used your ${DAILY_QUESTION_LIMIT} questions for the last 24 hours. Try again later.`;
/** The refusal when the company has used the Ask AI questions its plan includes for the month. */
export function monthlyLimitMessage(planName: string, limit: number, resetsOn: string): string {
  return `Your company has used the ${limit} Ask AI questions the ${planName} plan includes this month. The count resets on ${formatResetDate(resetsOn)}. An owner can change the plan in Settings → Billing.`;
}
export const UNAVAILABLE_MESSAGE = "Ask AI could not answer right now. Try again in a moment.";
