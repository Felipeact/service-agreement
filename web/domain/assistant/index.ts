/**
 * Ask AI (assistant door 1): what a member may ask, what a file they attach may carry, and how an answer is shown. Ask AI works
 * through the same tool layer as the MCP endpoint ([ai-tools](../ai-tools/index.ts)): it reads what it needs and, for a member who
 * may write records, creates customers, sites, equipment and draft agreements itself. It never sends, signs, cancels or reprices.
 * Nothing here reads a clock, the database or the network.
 */

import { formatResetDate } from "../billing/plan-limits";
import { validateImportFile, type ImportContentType } from "../imports";

/** Questions one member may ask in any 24 hours (a burst guard; the plan sets the company's monthly total). */
export const DAILY_QUESTION_LIMIT = 30;
export const MAX_QUESTION_LENGTH = 1500;
/** Earlier turns sent along so a follow-up makes sense. */
export const MAX_HISTORY_TURNS = 8;
export const MAX_ANSWER_LENGTH = 4000;

/** The most tool rounds one question may run, and the most records it may create: a loop or a file that tells the model to create hundreds stops here. */
export const MAX_TOOL_ROUNDS = 10;
export const MAX_WRITES_PER_QUESTION = 12;

/** What a file attached to a question may be: the app's list formats, small enough to travel in one request. */
export const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
export const ATTACH_ACCEPT = ".xlsx,.csv,.docx,.pdf";
/** What of an attached table the model is shown: the first rows, so the cost of one question stays bounded. */
export const MAX_ATTACHMENT_ROWS = 300;
export const MAX_ATTACHMENT_CHARS = 40_000;

/** `memo` is what the member does not read but the next question carries: the records this answer touched, with their ids. */
export type AssistantTurn = { role: "user" | "assistant"; text: string };
export type AssistantLink = { label: string; path: string };
export type AssistantReply = { answer: string; links: AssistantLink[]; memo: string };

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
      turns.push({ role: turn.role, text: turn.text.slice(0, turn.role === "user" ? MAX_QUESTION_LENGTH : MAX_ANSWER_LENGTH + 800) });
    }
  }
  return turns.slice(-MAX_HISTORY_TURNS);
}

/** An attached file's name and size checked against the list formats and the per-question size; the content type comes from the extension. */
export function validateAttachment(input: { name: string; size: number }): { ok: true; contentType: ImportContentType } | { ok: false; message: string } {
  const checked = validateImportFile(input);
  if (!checked.ok) return { ok: false, message: checked.message };
  if (input.size > MAX_ATTACHMENT_BYTES) return { ok: false, message: "Attach a file of 4 MB or less. For a longer list, use New agreement and upload it there." };
  return { ok: true, contentType: checked.value.contentType };
}

type Table = { source: string; header: string[]; rows: { ref: string; cells: string[] }[] };

/**
 * An attached list as text for the model: each table with its columns, then its rows one per line, cut to the first
 * `MAX_ATTACHMENT_ROWS` rows (and `MAX_ATTACHMENT_CHARS` characters). `note` says when the list was cut so the model can tell the member.
 */
export function formatAttachment(tables: Table[], documentText: string): { text: string; rows: number; note: string | null } {
  const lines: string[] = [];
  let rows = 0;
  let cut = false;
  for (const table of tables) {
    lines.push(`Table: ${table.source}`, `Columns: ${JSON.stringify(table.header)}`);
    for (const row of table.rows) {
      if (rows >= MAX_ATTACHMENT_ROWS) {
        cut = true;
        break;
      }
      lines.push(`${row.ref}: ${JSON.stringify(row.cells)}`);
      rows += 1;
    }
    if (cut) break;
  }
  let text = lines.join("\n");
  if (tables.length === 0 && documentText.trim() !== "") text = `Document text:\n${documentText.trim()}`;
  if (text.length > MAX_ATTACHMENT_CHARS) {
    text = text.slice(0, MAX_ATTACHMENT_CHARS);
    cut = true;
  }
  const total = tables.reduce((sum, table) => sum + table.rows.length, 0);
  return { text, rows, note: cut ? `Only the first ${rows} of ${total} rows are shown to you; tell the member the rest must be added in a second message or with New agreement.` : null };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const isId = (value: unknown): value is string => typeof value === "string" && UUID.test(value);

/**
 * The buttons under an answer, built from what the tools actually did, never from what the model says: a customer, site or
 * agreement it created or filled. A link is a path inside the app with a real id, at most four, each once.
 */
export function linksFromResults(results: { tool: string; data: unknown }[]): AssistantLink[] {
  const links: AssistantLink[] = [];
  const add = (label: string, path: string) => {
    if (!links.some((link) => link.path === path) && links.length < 4) links.push({ label, path });
  };
  for (const { tool, data } of results) {
    const record = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
    if (tool === "create_customer" && isId(record.customerId)) add("Open the customer", `/customers/${record.customerId}`);
    if ((tool === "create_site" || tool === "add_equipment") && isId(record.siteId)) add("Open the site", `/sites/${record.siteId}`);
    if (tool === "create_agreement_draft" && isId(record.agreementId)) add("Open the agreement", `/agreements/${record.agreementId}`);
    if (tool === "generate_service_lines" && typeof record.openAt === "string") {
      const id = record.openAt.replace(/^\/agreements\//, "");
      if (isId(id)) add("Open the agreement", `/agreements/${id}`);
    }
  }
  return links;
}

/** One line per record a write tool touched, with its id, so the next question can refer to it without searching again. */
export function memoFromResults(results: { tool: string; data: unknown }[]): string {
  const parts: string[] = [];
  for (const { tool, data } of results) {
    const record = typeof data === "object" && data !== null ? (data as Record<string, unknown>) : {};
    if (tool === "create_customer" && isId(record.customerId)) parts.push(`customer ${String(record.name ?? "")} (id ${record.customerId})`);
    if (tool === "create_site" && isId(record.siteId)) parts.push(`site ${String(record.name ?? "")} (id ${record.siteId})`);
    if (tool === "add_equipment" && isId(record.siteId)) parts.push(`${String(record.added ?? 0)} units added to site id ${record.siteId}`);
    if (tool === "create_agreement_draft" && isId(record.agreementId)) parts.push(`draft agreement (id ${record.agreementId})`);
    if (tool === "generate_service_lines" && typeof record.openAt === "string") parts.push(`service lines built for ${record.openAt}`);
  }
  return parts.length > 0 ? `[Done in this step: ${parts.join("; ")}]` : "";
}

/** A tool's answer as the model reads it: JSON, cut so one huge result cannot fill the conversation. */
export function toolResultText(result: { ok: true; data: unknown } | { ok: false; error: string }): string {
  const text = JSON.stringify(result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error });
  return text.length > 12_000 ? `${text.slice(0, 12_000)}…(cut)` : text;
}

export const LIMIT_MESSAGE = `You have used your ${DAILY_QUESTION_LIMIT} questions for the last 24 hours. Try again later.`;
/** The refusal when the company has used the Ask AI questions its plan includes for the month. */
export function monthlyLimitMessage(planName: string, limit: number, resetsOn: string): string {
  return `Your company has used the ${limit} Ask AI questions the ${planName} plan includes this month. The count resets on ${formatResetDate(resetsOn)}. An owner can change the plan in Settings → Billing.`;
}
export const UNAVAILABLE_MESSAGE = "Ask AI could not answer right now. Try again in a moment.";
export const STOPPED_MESSAGE = "I stopped before finishing: that took too many steps. Tell me where to continue.";
