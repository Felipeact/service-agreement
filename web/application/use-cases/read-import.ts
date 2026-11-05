import type { ReadOutcome } from "@/domain/imports";
import type { ImportJobStore, ImportParser, ParseResult, WriteFailure } from "@/application/ports";

export type ReadImportResult = { ok: true; outcome: ReadOutcome } | { ok: false; code: WriteFailure | "not_ready" };

/** The outcome a parse records: counts for tables, none for a PDF, or the reason it cannot be read. */
export function outcomeOf(result: ParseResult): ReadOutcome {
  if (!result.ok) return { status: "unreadable", reason: result.reason };
  if (result.parsed.format === "pdf") return { status: "parsed", tables: null, rows: null };
  const { tables } = result.parsed;
  return { status: "parsed", tables: tables.length, rows: tables.reduce((sum, table) => sum + table.rows.length, 0) };
}

/** Reads an uploaded job's file once; a job already read answers with its stored outcome, without downloading. */
export function makeReadImport(store: ImportJobStore, parser: ImportParser) {
  return async function readImport(jobId: string): Promise<ReadImportResult> {
    const file = await store.fileOf(jobId);
    if (!file.ok) return file;
    if (file.outcome) return { ok: true, outcome: file.outcome };
    if (file.status !== "uploaded" || !file.bytes) return { ok: false, code: "not_ready" };

    let parsed: ParseResult;
    try {
      parsed = await parser.parse(file.contentType, file.bytes);
    } catch (cause) {
      console.error(`Reading import ${jobId} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
      return { ok: false, code: "unavailable" };
    }
    return store.recordRead(jobId, outcomeOf(parsed));
  };
}
