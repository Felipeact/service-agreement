import type { AgreementTerms } from "../agreement";
import { formatLongDate, termMonthsLabel } from "../agreement/term";
import { formatSettingNumber, PROVINCE_NAMES } from "../org-settings";
import type { ContractParties } from "./parties";

/**
 * The names a contract template may use as `{{name}}` (contract-templates door 4). Stored templates bind to these, so a name is
 * added to and never renamed.
 */
export const TEMPLATE_VARIABLES = [
  "terms.paymentDays",
  "terms.cancellationNoticeDays",
  "terms.repairDiscountPct",
  "terms.cpiCapPct",
  "terms.cpiRenegotiationThresholdPct",
  "terms.renewalNoticeDays",
  "province",
  "term.label",
  "tenant.legalName",
  "customer.name",
  "site.name",
  "term.start",
  "tenant.address",
  "tenant.phone",
  "signer.name",
  "terms.taxNote",
] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

/** A variable's text, already carrying its unit, or `null` when there is nothing to say. */
export type TemplateValues = Record<TemplateVariable, string | null>;

export const BLOCK_TYPES = ["heading", "paragraph", "clause"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

export type Block = { type: BlockType; text: string };

/** What a stored template version holds (door 3). */
export type TemplateBody = { schema: 1; blocks: Block[] };

/** A block after its variables are filled in. */
export type RenderedBlock = { type: BlockType; text: string };

export const MAX_BLOCKS = 60;
export const MAX_TEXT = 2000;

/** The system contract template's version 1: the six sentences that used to be written in code. Equal to the stored row. */
export const SYSTEM_CONTRACT_BODY: TemplateBody = {
  schema: 1,
  blocks: [
    { type: "heading", text: "Terms" },
    { type: "clause", text: "Invoices are payable within {{terms.paymentDays}}." },
    { type: "clause", text: "Either party may cancel this contract with {{terms.cancellationNoticeDays}} written notice." },
    { type: "clause", text: "Repair work is discounted by {{terms.repairDiscountPct}}." },
    { type: "clause", text: "The annual price may rise with CPI, capped at {{terms.cpiCapPct}}." },
    { type: "clause", text: "This contract is governed by the laws of {{province}}." },
    {
      type: "clause",
      text:
        "This contract renews for successive {{term.label}} terms unless CPI is at or above {{terms.cpiRenegotiationThresholdPct}}, " +
        "when the parties renegotiate; the customer is notified {{terms.renewalNoticeDays}} before the end date.",
    },
  ],
};

const VARIABLE = /\{\{([^{}]*)\}\}/g;
const isVariable = (name: string): name is TemplateVariable => (TEMPLATE_VARIABLES as readonly string[]).includes(name);
const isBlockType = (type: unknown): type is BlockType => (BLOCK_TYPES as readonly unknown[]).includes(type);

const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;
const possessiveDays = (count: number) => `${count} ${count === 1 ? "day's" : "days'"}`;
const percent = (value: number) => `${formatSettingNumber(value)}%`;
const provinceName = (code: string) => (code in PROVINCE_NAMES ? PROVINCE_NAMES[code as keyof typeof PROVINCE_NAMES] : code);
const orNull = <T>(value: T | null | undefined, format: (value: T) => string): string | null => (value === null || value === undefined ? null : format(value));

/**
 * The text of every variable for a contract or an agreement: the frozen terms, the term's length, the term's start (`YYYY-MM-DD`,
 * read as `November 13, 2026`) and the parties. A value the source does not have is `null`.
 */
export function templateValues(terms: AgreementTerms | null, termMonths: number, parties: ContractParties | null, termStart: string | null = null): TemplateValues {
  return {
    "terms.paymentDays": orNull(terms?.paymentDays, days),
    "terms.cancellationNoticeDays": orNull(terms?.cancellationNoticeDays, possessiveDays),
    "terms.repairDiscountPct": orNull(terms?.repairDiscountPct, percent),
    "terms.cpiCapPct": orNull(terms?.cpiCapPct, percent),
    "terms.cpiRenegotiationThresholdPct": orNull(terms?.cpiRenegotiationThresholdPct, percent),
    "terms.renewalNoticeDays": orNull(terms?.renewalNoticeDays, days),
    province: orNull(terms?.governingProvince, provinceName),
    "term.label": terms ? termMonthsLabel(termMonths) : null,
    "tenant.legalName": parties?.contractor.legalName ?? null,
    "customer.name": parties?.customer.name ?? null,
    "site.name": parties?.site.name ?? null,
    "term.start": orNull(termStart, formatLongDate),
    "tenant.address": parties?.contractor.address ?? null,
    "tenant.phone": parties?.contractor.phone ?? null,
    "signer.name": parties?.signer?.name ?? null,
    "terms.taxNote": terms?.taxNote ?? null,
  };
}

/** The first `{{name}}` in `text` that is not on the whitelist, or `null`. */
export function unknownVariable(text: string): string | null {
  for (const match of text.matchAll(VARIABLE)) {
    const name = match[1].trim();
    if (!isVariable(name)) return name;
  }
  return null;
}

/** `text` with every variable filled; `missing` is true when one had no value (an unknown name counts as no value). */
export function fillVariables(text: string, values: TemplateValues): { text: string; missing: boolean } {
  let missing = false;
  const filled = text.replace(VARIABLE, (_whole, raw: string) => {
    const name = String(raw).trim();
    const value = isVariable(name) ? values[name] : null;
    if (value === null) {
      missing = true;
      return "";
    }
    return value;
  });
  return { text: filled, missing };
}

export type BlocksValidation = { ok: true; body: TemplateBody } | { ok: false; reason: string };

/** Whether `input` is a template body this product can store and draw: known schema, block types, bounds and variables. */
export function validateBlocks(input: unknown): BlocksValidation {
  if (typeof input !== "object" || input === null) return { ok: false, reason: "The template is not an object." };
  const { schema, blocks } = input as { schema?: unknown; blocks?: unknown };
  if (schema !== 1) return { ok: false, reason: `Unknown schema ${String(schema)}; this product reads schema 1.` };
  if (!Array.isArray(blocks)) return { ok: false, reason: "The template has no list of blocks." };
  if (blocks.length > MAX_BLOCKS) return { ok: false, reason: `Too many blocks (${blocks.length}, at most ${MAX_BLOCKS}).` };
  for (const [index, block] of blocks.entries()) {
    if (typeof block !== "object" || block === null) return { ok: false, reason: `Block ${index + 1} is not an object.` };
    const { type, text } = block as { type?: unknown; text?: unknown };
    if (!isBlockType(type)) return { ok: false, reason: `Block ${index + 1} has an unknown type: ${String(type)}.` };
    if (typeof text !== "string") return { ok: false, reason: `Block ${index + 1} has no text.` };
    if (text.length > MAX_TEXT) return { ok: false, reason: `Block ${index + 1} is too long (${text.length} characters, at most ${MAX_TEXT}).` };
    for (const match of text.matchAll(VARIABLE)) {
      const name = match[1].trim();
      if (!isVariable(name)) return { ok: false, reason: `Block ${index + 1} uses an unknown variable: ${name}.` };
    }
  }
  return { ok: true, body: { schema: 1, blocks: blocks as Block[] } };
}

/**
 * Fills the variables of a stored body. A clause that uses a variable with no value is left out, so an unset term states
 * nothing; a heading or paragraph prints with that variable as nothing. An unknown variable counts as no value, so a stored
 * version can always be drawn. Values are inserted as they are and never read for variables again. A heading with nothing
 * under it before the next heading, or the end, is dropped.
 */
export function renderBlocks(body: TemplateBody, values: TemplateValues): RenderedBlock[] {
  const rendered: RenderedBlock[] = [];
  for (const block of body.blocks) {
    const { text, missing } = fillVariables(block.text, values);
    if (block.type === "clause" && missing) continue;
    rendered.push({ type: block.type, text });
  }
  return rendered.filter((block, index) => block.type !== "heading" || (rendered[index + 1] !== undefined && rendered[index + 1].type !== "heading"));
}
