import type { AddDraftResult, CatalogDrafter, CatalogWriter, ImportParser } from "@/application/ports";
import { validateDraft, validateTrade, type DraftType } from "@/domain/catalog-draft";
import type { Role } from "@/domain/members";
import { contentTypeFor, extensionOf } from "@/domain/imports";

/** The size of the biggest proposal the draft reads (other-trade-draft assumption); the framework body limit is set above it. */
export const MAX_DRAFT_FILE_BYTES = 4_194_304;
export const MAX_DRAFT_NOTES = 2000;

export type DraftCatalogInput = {
  /** The member's role in the org, or `null` for a signed-out user or one with no membership. */
  role: Role | null;
  trade: string;
  notes: string;
  /** The attached file, read from the request; it is parsed and dropped, never stored. */
  file?: { name: string; bytes: Uint8Array };
};

export type DraftCatalogResult =
  | { ok: true; trade: string; types: DraftType[] }
  | { ok: false; code: "invalid" | "forbidden" | "not_empty" | "unreadable" | "too_large" | "unavailable" };

export type AcceptDraftInput = { role: Role | null; orgId: string; trade: string; types: unknown };
export type AcceptDraftResult = AddDraftResult;

const MANAGERS: readonly Role[] = ["owner", "admin"];
const isManager = (role: Role | null): role is Role => role !== null && MANAGERS.includes(role);

/**
 * Drafts a catalog for an org that has no types yet: checks who is asking and that the catalog is empty, reads the optional file,
 * and asks the drafter. Nothing is written; the draft goes back to the owner to review (door 3).
 */
export function makeDraftCatalog(catalogSize: () => Promise<number>, parser: ImportParser, drafter: CatalogDrafter) {
  return async function draftCatalog(input: DraftCatalogInput): Promise<DraftCatalogResult> {
    if (!isManager(input.role)) return { ok: false, code: "forbidden" };
    const trade = validateTrade(input.trade);
    if (trade === null || input.notes.length > MAX_DRAFT_NOTES) return { ok: false, code: "invalid" };

    try {
      if ((await catalogSize()) > 0) return { ok: false, code: "not_empty" };
    } catch (cause) {
      console.error(`Reading the catalog failed: ${cause instanceof Error ? cause.message : String(cause)}`);
      return { ok: false, code: "unavailable" };
    }

    let file: Parameters<CatalogDrafter["draft"]>[0]["file"];
    if (input.file) {
      const contentType = contentTypeFor(extensionOf(input.file.name));
      if (!contentType || input.file.bytes.length === 0) return { ok: false, code: "unreadable" };
      if (input.file.bytes.length > MAX_DRAFT_FILE_BYTES) return { ok: false, code: "too_large" };
      const parsed = await parser.parse(contentType, input.file.bytes);
      if (!parsed.ok) return { ok: false, code: "unreadable" };
      file = parsed.parsed.format === "pdf" ? { kind: "pdf", bytes: parsed.parsed.bytes } : { kind: "text", text: parsed.parsed.text };
    }

    const drafted = await drafter.draft({ trade, notes: input.notes.trim(), file });
    return drafted.ok ? { ok: true, trade, types: drafted.types } : drafted;
  };
}

/** Writes the draft the owner reviewed, once and whole, or nothing. The database decides "still empty" (door 2). */
export function makeAcceptCatalogDraft(writer: CatalogWriter) {
  return async function acceptCatalogDraft(input: AcceptDraftInput): Promise<AcceptDraftResult> {
    if (!isManager(input.role)) return { ok: false, code: "forbidden" };
    const trade = validateTrade(input.trade);
    const types = validateDraft(input.types);
    if (trade === null || types === null) return { ok: false, code: "invalid" };
    return writer.add(input.orgId, trade, types);
  };
}
