import { chunksOf, matchAssetType, quantityColumn, quantityOf, splitQuantity } from "@/domain/imports";
import type {
  AssetExtractor,
  AssetTypeCatalog,
  ExtractChunk,
  ExtractedRow,
  ImportAllowance,
  ImportJobStore,
  ImportParser,
  ImportRowInput,
  WriteFailure,
} from "@/application/ports";

export type ExtractImportResult =
  | { ok: true; state: "extracting"; done: number; total: number }
  | { ok: true; state: "extracted"; rows: number; unmatched: number }
  | { ok: false; code: WriteFailure | "not_ready" | "too_large" }
  | { ok: false; code: "plan_limit"; plan: string; limit: number; used: number; resetsOn: string };

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

/** The count in the "Qty" column of the file row this row was read from, with the type text as the label; `null` when there is none. */
function countFromColumn(row: ExtractedRow, chunk: ExtractChunk): { label: string; qty: number } | null {
  const label = cleaned(row.assetTypeRaw);
  const ref = cleaned(row.sourceRef);
  if (chunk.kind !== "rows" || label === null || ref === null) return null;
  const column = quantityColumn(chunk.header);
  const source = column === null ? undefined : chunk.rows.find((candidate) => candidate.ref === ref);
  const qty = source && column !== null ? quantityOf(source.cells[column]) : null;
  return qty === null ? null : { label, qty };
}

/**
 * The rows one extracted row stands for. A row with no unit # whose file row has a count in a "Qty" column, or whose type text carries a count ("VAV boxes (qty 24)", "Fire dampers 40") becomes
 * that many rows, the count removed from the type text and the units numbered 1 to N, never above `medium` confidence so the
 * review looks at them. Anything else is one row (qa-p1-p2 C7005).
 */
function rowsFor(row: ExtractedRow, chunk: ExtractChunk, refs: Set<string>, types: Awaited<ReturnType<AssetTypeCatalog["list"]>>): ImportRowInput[] {
  const counted = cleaned(row.unitNo) === null ? (countFromColumn(row, chunk) ?? splitQuantity(cleaned(row.assetTypeRaw))) : null;
  if (!counted) return [rowFor(row, chunk, refs, types)];
  const confidence = row.confidence === "high" ? "medium" : row.confidence;
  return Array.from({ length: counted.qty }, (_, i) => rowFor({ ...row, assetTypeRaw: counted.label, unitNo: String(i + 1), confidence }, chunk, refs, types));
}

/**
 * Takes the next chunk of a read file, has Claude extract its rows, matches each to the org's types and records them.
 * One call does one chunk: the browser calls again until the job is `extracted`, and a stored cursor makes a retry resume.
 * The first chunk of a job asks the plan's AI-import allowance before Claude is called; a job already started never does, so
 * it can finish (plan-limits S2). Without an allowance every job is let through.
 */
export function makeExtractImport(store: ImportJobStore, parser: ImportParser, extractor: AssetExtractor, catalog: AssetTypeCatalog, allowance?: ImportAllowance) {
  return async function extractImport(jobId: string): Promise<ExtractImportResult> {
    const source = await store.sourceOf(jobId);
    if (!source.ok) return source;
    if (source.status === "extracted") {
      return source.result ? { ok: true, state: "extracted", ...source.result } : UNAVAILABLE;
    }
    if ((source.status !== "parsed" && source.status !== "extracting") || !source.bytes) return { ok: false, code: "not_ready" };

    let chunks: ExtractChunk[];
    let types: Awaited<ReturnType<AssetTypeCatalog["list"]>>;
    let tradeContext: string | null;
    try {
      const parsed = await parser.parse(source.contentType, source.bytes);
      if (!parsed.ok) throw new Error(`the file no longer reads (${parsed.reason})`);
      chunks = chunksOf(parsed.parsed);
      types = await catalog.list();
      tradeContext = await catalog.tradeContext();
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

    if (cursor === null && allowance) {
      let allowed: Awaited<ReturnType<ImportAllowance["check"]>>;
      try {
        allowed = await allowance.check(jobId);
      } catch (cause) {
        console.error(`Reading the allowance for import ${jobId} failed: ${cause instanceof Error ? cause.message : String(cause)}`);
        return UNAVAILABLE;
      }
      if (!allowed.ok) return allowed.code === "unavailable" ? UNAVAILABLE : allowed;
      if (!allowed.allowed) return { ok: false, code: "plan_limit", plan: allowed.plan, limit: allowed.limit, used: allowed.used, resetsOn: allowed.resetsOn };
    }

    const answered = await extractor.extract(chunk, tradeContext);
    if (!answered.ok) return answered;

    const refs = new Set(chunk.kind === "rows" ? chunk.rows.map((row) => row.ref) : []);
    const recorded = await store.recordExtraction(
      jobId,
      cursor,
      total,
      answered.rows.flatMap((row) => rowsFor(row, chunk, refs, types)),
      answered.usage,
    );
    if (!recorded.ok) return recorded;
    if (!recorded.done) return { ok: true, state: "extracting", done: recorded.progress.cursor, total: recorded.progress.total };

    const finished = await store.sourceOf(jobId);
    if (!finished.ok) return finished;
    return finished.status === "extracted" && finished.result ? { ok: true, state: "extracted", ...finished.result } : UNAVAILABLE;
  };
}
