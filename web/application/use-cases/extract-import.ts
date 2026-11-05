import { chunksOf, matchAssetType } from "@/domain/imports";
import type {
  AssetExtractor,
  AssetTypeCatalog,
  ExtractChunk,
  ExtractedRow,
  ImportJobStore,
  ImportParser,
  ImportRowInput,
  WriteFailure,
} from "@/application/ports";

export type ExtractImportResult =
  | { ok: true; state: "extracting"; done: number; total: number }
  | { ok: true; state: "extracted"; rows: number; unmatched: number }
  | { ok: false; code: WriteFailure | "not_ready" | "too_large" };

const UNAVAILABLE = { ok: false, code: "unavailable" } as const;

/** Trims; an empty value is `null`. */
const cleaned = (text: string | null): string | null => text?.trim() || null;

/** What is stored for a row: cleaned text, a `source_ref` that really was in the chunk, and the org's type if one matched. */
function rowFor(row: ExtractedRow, chunk: ExtractChunk, refs: Set<string>, types: Awaited<ReturnType<AssetTypeCatalog["list"]>>): ImportRowInput {
  const assetTypeRaw = cleaned(row.assetTypeRaw);
  const sourceRef = cleaned(row.sourceRef);
  const invented = chunk.kind === "rows" && (sourceRef === null || !refs.has(sourceRef));
  return {
    assetTypeRaw,
    unitNo: cleaned(row.unitNo),
    typeModel: cleaned(row.typeModel),
    location: cleaned(row.location),
    confidence: invented ? "low" : row.confidence,
    sourceRef: invented ? null : sourceRef,
    assetTypeId: matchAssetType(assetTypeRaw, types),
  };
}

/**
 * Takes the next chunk of a read file, has Claude extract its rows, matches each to the org's types and records them.
 * One call does one chunk: the browser calls again until the job is `extracted`, and a stored cursor makes a retry resume.
 */
export function makeExtractImport(store: ImportJobStore, parser: ImportParser, extractor: AssetExtractor, catalog: AssetTypeCatalog) {
  return async function extractImport(jobId: string): Promise<ExtractImportResult> {
    const source = await store.sourceOf(jobId);
    if (!source.ok) return source;
    if (source.status === "extracted") {
      return source.result ? { ok: true, state: "extracted", ...source.result } : UNAVAILABLE;
    }
    if ((source.status !== "parsed" && source.status !== "extracting") || !source.bytes) return { ok: false, code: "not_ready" };

    let chunks: ExtractChunk[];
    let types: Awaited<ReturnType<AssetTypeCatalog["list"]>>;
    try {
      const parsed = await parser.parse(source.contentType, source.bytes);
      if (!parsed.ok) throw new Error(`the file no longer reads (${parsed.reason})`);
      chunks = chunksOf(parsed.parsed);
      types = await catalog.list();
    } catch (cause) {
      console.error(`Extracting import ${jobId} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
      return UNAVAILABLE;
    }

    const cursor = source.progress?.cursor ?? null;
    const total = source.progress?.total ?? chunks.length;
    const chunk = chunks[cursor ?? 0];
    if (!chunk || total < 1) {
      console.error(`Extracting import ${jobId} failed: no chunk ${cursor ?? 0} of ${total}`);
      return UNAVAILABLE;
    }

    const answered = await extractor.extract(chunk);
    if (!answered.ok) return answered;

    const refs = new Set(chunk.kind === "rows" ? chunk.rows.map((row) => row.ref) : []);
    const recorded = await store.recordExtraction(
      jobId,
      cursor,
      total,
      answered.rows.map((row) => rowFor(row, chunk, refs, types)),
    );
    if (!recorded.ok) return recorded;
    if (!recorded.done) return { ok: true, state: "extracting", done: recorded.progress.cursor, total: recorded.progress.total };

    const finished = await store.sourceOf(jobId);
    if (!finished.ok) return finished;
    return finished.status === "extracted" && finished.result ? { ok: true, state: "extracted", ...finished.result } : UNAVAILABLE;
  };
}
