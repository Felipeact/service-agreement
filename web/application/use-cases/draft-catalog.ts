import type { CatalogDrafter, ImportParser } from "@/application/ports";
import type { ImportContentType } from "@/domain/imports";
import { normalizeDraft, type DraftType } from "@/domain/task-library/draft";

export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ACCEPTED: readonly string[] = [PDF, DOCX];

export type DraftRequest = {
  description?: string;
  file?: { contentType: string; bytes: Uint8Array };
};

export type DraftOutcome =
  | { ok: true; types: DraftType[] }
  | { ok: false; error: "invalid_input" | "file_too_large" | "unsupported_type" | "empty_draft" | "unavailable" }
  /** `too_large` is a file that read fine but is more than one answer can cover; `unreadable` is a file nothing could be read from. */
  | { ok: false; error: "unreadable"; reason: "unreadable" | "too_large" };

/**
 * Turns what the owner sent into a cleaned draft of types (other-trade-draft door 2). The proposal is read in this call and
 * nothing is kept: only the number of types and the token usage are logged, never what the owner sent or Claude answered.
 */
export function makeDraftCatalog(deps: { parser: ImportParser; drafter: CatalogDrafter }) {
  return async function draftCatalog(request: DraftRequest): Promise<DraftOutcome> {
    const description = request.description?.trim() ?? "";
    const file = request.file;
    if (description.length > MAX_DESCRIPTION_LENGTH || (description === "" && !file)) return { ok: false, error: "invalid_input" };

    let document: { kind: "text"; text: string } | { kind: "pdf"; bytes: Uint8Array } | undefined;
    if (file) {
      if (file.bytes.byteLength > MAX_FILE_BYTES) return { ok: false, error: "file_too_large" };
      if (!ACCEPTED.includes(file.contentType)) return { ok: false, error: "unsupported_type" };
      const read = await deps.parser.parse(file.contentType as ImportContentType, file.bytes);
      if (!read.ok) return { ok: false, error: "unreadable", reason: "unreadable" };
      if (read.parsed.format === "pdf") document = { kind: "pdf", bytes: read.parsed.bytes };
      else if (read.parsed.text.trim() === "") return { ok: false, error: "unreadable", reason: "unreadable" };
      else document = { kind: "text", text: read.parsed.text };
    }

    const drafted = await deps.drafter.draft({ ...(description && { description }), ...(document && { document }) });
    if (!drafted.ok) {
      if (drafted.code === "too_large") return { ok: false, error: "unreadable", reason: "too_large" };
      return { ok: false, error: drafted.code === "empty" ? "empty_draft" : "unavailable" };
    }

    const types = normalizeDraft({ types: drafted.types });
    if (types.length === 0) return { ok: false, error: "empty_draft" };
    const usage = drafted.usage ? `, ${drafted.usage.inputTokens} input tokens, ${drafted.usage.outputTokens} output tokens` : "";
    console.info(`Drafted a catalog: ${types.length} ${types.length === 1 ? "type" : "types"}${usage}`);
    return { ok: true, types };
  };
}
