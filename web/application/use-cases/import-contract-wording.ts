import type { ContractSplitter, ImportParser } from "@/application/ports";
import { importedWordingForm } from "@/domain/contract/import";
import type { ContractLayoutForm } from "@/domain/contract/layout-form";
import { extensionOf } from "@/domain/imports";
import type { Role } from "@/domain/members";

/** The biggest contract the import reads; the framework body limit (5 MB) is set above it. */
export const MAX_CONTRACT_FILE_BYTES = 4_194_304;

const KINDS = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pdf: "application/pdf",
} as const;

export type ImportContractWordingInput = {
  /** The member's role in the org, or `null` for a signed-out user or one with no membership. */
  role: Role | null;
  /** The attached file, read from the request; parsed and dropped, never stored. */
  file?: { name: string; bytes: Uint8Array };
};

export type ImportContractWordingResult =
  | { ok: true; form: ContractLayoutForm }
  | { ok: false; code: "invalid" | "forbidden" | "unreadable" | "too_large" | "unavailable" };

/**
 * Reads an uploaded contract into the editor's form: checks who is asking and the file, parses it, asks the splitter, builds the
 * rows. Writes nothing; the owner reviews the form and saves through the existing action (contract-import door 2).
 */
export function makeImportContractWording(parser: ImportParser, splitter: ContractSplitter) {
  return async function importContractWording(input: ImportContractWordingInput): Promise<ImportContractWordingResult> {
    if (input.role !== "owner" && input.role !== "admin") return { ok: false, code: "forbidden" };
    if (!input.file || input.file.bytes.length === 0) return { ok: false, code: "invalid" };

    const extension = extensionOf(input.file.name).toLowerCase();
    if (extension !== "docx" && extension !== "pdf") return { ok: false, code: "unreadable" };
    if (input.file.bytes.length > MAX_CONTRACT_FILE_BYTES) return { ok: false, code: "too_large" };

    const parsed = await parser.parse(KINDS[extension], input.file.bytes);
    if (!parsed.ok) return { ok: false, code: "unreadable" };
    const file = parsed.parsed.format === "pdf" ? ({ kind: "pdf", bytes: parsed.parsed.bytes } as const) : ({ kind: "text", text: parsed.parsed.text } as const);

    const split = await splitter.split({ file });
    if (!split.ok) return split;
    const form = importedWordingForm(split.blocks);
    return form ? { ok: true, form } : { ok: false, code: "unavailable" };
  };
}
