import { MAX_TEXT, type BlockType } from "./template";
import { DEFAULT_CONTRACT_DOC, validateContractWording } from "./layout";
import { rowsFromLayout } from "../agreement/layout-form";
import type { LayoutItem } from "../agreement/layout";
import type { ContractLayoutForm } from "./layout-form";

/**
 * The merge variables an import may place (contract-import door 3): the parties, the site, the signer and the term. Never a
 * `terms.*` name or the province: the model cannot see the tenant's settings, so it would swap the document's own figure for them.
 */
export const IMPORT_VARIABLES = [
  "tenant.legalName",
  "tenant.address",
  "tenant.phone",
  "customer.name",
  "site.name",
  "signer.name",
  "term.start",
  "term.label",
] as const;

export const SPLIT_BLOCK_TYPES = ["heading", "paragraph", "clause"] as const satisfies readonly BlockType[];
export const MAX_SPLIT_BLOCKS = 40;

/** One block read from an uploaded contract (door 1). */
export type SplitBlock = { type: BlockType; text: string };

const VARIABLE = /\{\{([^{}]*)\}\}/g;

/** The blocks of Claude's answer when every one is within the bounds and names only import variables; `null` otherwise. */
export function validateSplitBlocks(input: unknown): SplitBlock[] | null {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_SPLIT_BLOCKS) return null;
  const blocks: SplitBlock[] = [];
  for (const item of input) {
    if (typeof item !== "object" || item === null) return null;
    // Door 1 sets additionalProperties false; the app holds the same line instead of trusting the provider alone.
    if (Object.keys(item).some((key) => key !== "type" && key !== "text")) return null;
    const { type, text } = item as { type?: unknown; text?: unknown };
    if (typeof type !== "string" || !(SPLIT_BLOCK_TYPES as readonly string[]).includes(type)) return null;
    if (typeof text !== "string" || text.trim() === "" || text.length > MAX_TEXT) return null;
    for (const match of text.matchAll(VARIABLE)) {
      if (!(IMPORT_VARIABLES as readonly string[]).includes(match[1].trim())) return null;
    }
    blocks.push({ type: type as BlockType, text });
  }
  return blocks;
}

/**
 * The editor form for read blocks: the price section, the blocks in order, the signatures section, with the default contract
 * options. `null` when the blocks are out of bounds or the result is not wording this product can store.
 */
export function importedWordingForm(input: unknown): ContractLayoutForm | null {
  const blocks = validateSplitBlocks(input);
  if (!blocks) return null;
  const layout: LayoutItem[] = [
    { kind: "section", key: "price" },
    ...blocks.map((block): LayoutItem => ({ kind: "block", type: block.type, text: block.text })),
    { kind: "section", key: "signatures" },
  ];
  const doc = { ...DEFAULT_CONTRACT_DOC };
  if (!validateContractWording({ schema: 2, doc, layout }).ok) return null;
  return { doc, layout: rowsFromLayout(layout) };
}
