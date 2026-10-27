/** The largest file an import accepts: 20 MB, the same number as the `imports` bucket's `file_size_limit`. */
export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;

export const MAX_IMPORT_NAME = 255;

/** The canonical content type per accepted extension; the bucket allows exactly these four. */
const CONTENT_TYPES = {
  pdf: "application/pdf",
  csv: "text/csv",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
} as const;

export type ImportContentType = (typeof CONTENT_TYPES)[keyof typeof CONTENT_TYPES];

export const IMPORT_ACCEPT = ".xlsx,.csv,.docx,.pdf";

export const IMPORT_MESSAGES = {
  extension: "Choose an Excel (.xlsx), CSV, Word (.docx) or PDF file",
  empty: "This file is empty",
  tooLarge: "Files can be up to 20 MB",
  nameTooLong: "File name must be 255 characters or fewer",
} as const;

/** The type sent to Storage for an extension (case-insensitive), or `null` when it is not accepted. Never the browser's `File.type`. */
export function contentTypeFor(extension: string): ImportContentType | null {
  const key = extension.toLowerCase();
  return Object.hasOwn(CONTENT_TYPES, key) ? CONTENT_TYPES[key as keyof typeof CONTENT_TYPES] : null;
}

/** The text after the last dot, or `""` when there is none. */
export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1);
}

export type ImportFileInput = { name: string; size: number };
export type ImportFile = { name: string; size: number; contentType: ImportContentType };

export function validateImportFile(input: ImportFileInput): { ok: true; value: ImportFile } | { ok: false; message: string } {
  const contentType = contentTypeFor(extensionOf(input.name));
  if (!contentType) return { ok: false, message: IMPORT_MESSAGES.extension };
  if (input.name.length > MAX_IMPORT_NAME) return { ok: false, message: IMPORT_MESSAGES.nameTooLong };
  if (!Number.isSafeInteger(input.size) || input.size <= 0) return { ok: false, message: IMPORT_MESSAGES.empty };
  if (input.size > MAX_IMPORT_BYTES) return { ok: false, message: IMPORT_MESSAGES.tooLarge };
  return { ok: true, value: { name: input.name, size: input.size, contentType } };
}

/** Under 1 MB in whole KB (at least 1), otherwise MB with one decimal. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The most data rows one file may hold across its tables (plan Assumptions). */
export const MAX_IMPORT_ROWS = 2000;

/** Why a file cannot be read; stored in `import_jobs.read_error` (door 1). */
export type ReadError = "corrupt" | "password_protected" | "no_table" | "no_text" | "too_many_rows";

export const READ_ERROR_MESSAGES: Record<ReadError, string> = {
  corrupt: "This file is damaged or isn't the format its name says.",
  password_protected:
    "This file is password-protected or saved in an older Office format. Save it as .xlsx or .docx without a password and upload it again.",
  no_table: "No table with column headings was found.",
  no_text: "This document has no text.",
  too_many_rows: "This list has more than 2,000 rows. Split it and upload each part.",
};

/** What a read recorded on the job. A PDF has no counts: Claude reads it at extraction. */
export type ReadOutcome =
  | { status: "parsed"; tables: number | null; rows: number | null }
  | { status: "unreadable"; reason: ReadError };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** The line under a read job: rows and tables found, text only, or a PDF left to extraction. */
export function readSummary(tables: number | null, rows: number | null): string {
  if (tables === null || rows === null) return "PDF, read at extraction";
  if (tables === 0) return "Text only, no table";
  return `${plural(rows, "row")} in ${plural(tables, "table")}`;
}

/** The line under an extracted job: rows found and how many still need an equipment type. */
export function extractionSummary(rows: number, unmatched: number): string {
  if (rows === 0) return "No equipment found";
  if (unmatched === 0) return plural(rows, "row");
  return `${plural(rows, "row")}, ${unmatched} ${unmatched === 1 ? "needs" : "need"} an equipment type`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(id: string): boolean {
  return UUID.test(id);
}

/** Data rows sent to Claude per call (import-extract door 3). */
export const CHUNK_ROWS = 100;

/** What `ParsedImport` needs to be cut into chunks. The domain cannot import the ports, so the shape is repeated; the use case's call checks the two stay in step. */
export type ChunkSource =
  | { format: "table"; tables: { source: string; header: string[]; rows: { ref: string; cells: string[] }[] }[]; text: string }
  | { format: "pdf"; bytes: Uint8Array };

export type Chunk =
  | { kind: "rows"; table: string; header: string[]; rows: { ref: string; cells: string[] }[] }
  | { kind: "text"; text: string }
  | { kind: "pdf"; bytes: Uint8Array };

/** Chunks per table: up to `CHUNK_ROWS` data rows, never spanning two tables. */
function tableChunks(source: Extract<ChunkSource, { format: "table" }>): Extract<Chunk, { kind: "rows" }>[] {
  return source.tables.flatMap((table) => {
    const chunks: Extract<Chunk, { kind: "rows" }>[] = [];
    for (let from = 0; from < table.rows.length; from += CHUNK_ROWS) {
      chunks.push({ kind: "rows", table: table.source, header: table.header, rows: table.rows.slice(from, from + CHUNK_ROWS) });
    }
    return chunks;
  });
}

/** The chunks of a file in order: its tables' rows, else the document text, else the whole PDF. The text of a file that has tables is not sent. */
export function chunksOf(source: ChunkSource): Chunk[] {
  if (source.format === "pdf") return [{ kind: "pdf", bytes: source.bytes }];
  return source.tables.length > 0 ? tableChunks(source) : [{ kind: "text", text: source.text }];
}

/** The text compared when matching a type: lowercased, every run of non-letters and non-digits one space, trimmed. */
export function normalized(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export type AssetTypeRef = { id: string; code: string; name: string };

/** Other ways a list writes a standard type, by catalog code. Compared after `normalized`. Grows from review-grid misses. */
export const SYNONYMS: Record<string, string[]> = {
  AHU: ["air handling unit", "air handler", "air handler unit"],
  BOILER: ["hot water boiler", "steam boiler", "boilers"],
  CHILLER: ["water chiller", "chillers"],
  COOLING_TOWER: ["cooling towers"],
  DUCTLESS_SPLIT: ["mini split", "ductless mini split", "ductless heat pump"],
  ERV: ["energy recovery ventilator", "energy recovery unit"],
  EXHAUST_FAN: ["exhaust fans", "ef", "roof exhaust fan"],
  FAN_COIL: ["fan coil unit", "fcu"],
  FURNACE: ["gas furnace", "furnaces"],
  HEAT_EXCHANGER: ["plate heat exchanger", "hx"],
  HRV: ["heat recovery ventilator"],
  ICE_MACHINE: ["ice maker"],
  MINI_VRF: ["mini vrf system"],
  MUA: ["mau", "make up air", "make up air unit", "makeup air unit", "make up air handler"],
  PTAC: ["packaged terminal ac", "packaged terminal air conditioner"],
  PUMP: ["circulating pump", "circulation pump", "pumps"],
  RTU: ["rooftop unit", "rooftop", "roof top unit", "roof top", "rooftop air conditioner", "packaged rooftop unit"],
  STORAGE_TANK: ["storage tanks", "hot water storage tank"],
  SUPPLY_FAN: ["supply fans"],
  UNITARY_SPLIT: ["split system", "unitary split"],
  UNIT_HEATER_ELECTRIC: ["electric unit heater"],
  UNIT_HEATER_GAS: ["gas unit heater", "gas fired unit heater"],
  VRF_OUTDOOR: ["vrf outdoor unit", "vrf condenser"],
  WSHP: ["water source heat pump", "water to air heat pump"],
  WALK_IN_COOLER: ["walk in cooler", "walk in refrigerator"],
  WALK_IN_FREEZER: ["walk in freezer"],
  WYE_STRAINER: ["y strainer", "wye strainers"],
};

/**
 * The org's type a list's wording means, or `null`. A code or name wins; only then a synonym of a code the org has.
 * Blank text, no match and more than one distinct match all give `null`: a guess would hide a row the review must see.
 */
export function matchAssetType(raw: string | null, types: AssetTypeRef[]): string | null {
  const wanted = normalized(raw ?? "");
  if (!wanted) return null;
  const direct = new Set(types.filter((t) => normalized(t.code) === wanted || normalized(t.name) === wanted).map((t) => t.id));
  if (direct.size > 0) return direct.size === 1 ? [...direct][0] : null;
  const viaSynonym = new Set(
    types.filter((t) => (SYNONYMS[t.code] ?? []).some((synonym) => normalized(synonym) === wanted)).map((t) => t.id),
  );
  return viaSynonym.size === 1 ? [...viaSynonym][0] : null;
}

/** One extracted row as the review needs it. The domain cannot import the ports, so this repeats `ImportRowView`'s fields. */
export type ReviewRow = {
  id: string;
  position: number;
  assetTypeRaw: string | null;
  assetTypeId: string | null;
  unitNo: string | null;
  typeModel: string | null;
  location: string | null;
  confidence: "low" | "medium" | "high";
  skipped: boolean;
};

/** What stops a row becoming a good asset. `needs_type` and `too_long` block the commit; the others only ask for a look. */
export type ReviewFlag =
  | { kind: "needs_type" }
  | { kind: "too_long"; field: "Unit #" | "Type/model" | "Location/access" }
  | { kind: "check" }
  | { kind: "same_as"; position: number }
  | { kind: "on_site" };

/** The asset form's limits (`validateAsset`), which the commit enforces too. */
const LIMITS = [
  { key: "unitNo", max: 40, field: "Unit #" },
  { key: "typeModel", max: 120, field: "Type/model" },
  { key: "location", max: 300, field: "Location/access" },
] as const;

/** The same unit read twice: same type and same `normalized` unit #. No key without both. */
function duplicateKey(assetTypeId: string | null, unitNo: string | null): string | null {
  const unit = normalized(unitNo ?? "");
  return assetTypeId && unit ? `${assetTypeId} ${unit}` : null;
}

/** Each row's flags, by row id. A skipped row has none; the first included row of a duplicate key is not flagged. */
export function flagRows(rows: ReviewRow[], siteAssets: { assetTypeId: string; unitNo: string | null }[]): Map<string, ReviewFlag[]> {
  const onSite = new Set(siteAssets.map((asset) => duplicateKey(asset.assetTypeId, asset.unitNo)).filter((key) => key !== null));
  const firstOf = new Map<string, number>();
  const flags = new Map<string, ReviewFlag[]>();
  for (const row of [...rows].sort((a, b) => a.position - b.position)) {
    const found: ReviewFlag[] = [];
    flags.set(row.id, found);
    if (row.skipped) continue;
    if (row.assetTypeId === null) found.push({ kind: "needs_type" });
    for (const limit of LIMITS) if ((row[limit.key]?.length ?? 0) > limit.max) found.push({ kind: "too_long", field: limit.field });
    if (row.confidence === "low") found.push({ kind: "check" });
    const key = duplicateKey(row.assetTypeId, row.unitNo);
    if (key !== null) {
      const first = firstOf.get(key);
      if (first === undefined) firstOf.set(key, row.position);
      else found.push({ kind: "same_as", position: first });
      if (onSite.has(key)) found.push({ kind: "on_site" });
    }
  }
  return flags;
}

export const isBlocking = (flag: ReviewFlag) => flag.kind === "needs_type" || flag.kind === "too_long";

/** Rows shown per page of the review. */
export const REVIEW_PAGE_ROWS = 100;

/** The page a `?page` value asks for: a whole number from 1 to the last page, else page 1. `from` and `to` are 1-based. */
export function pageOf(total: number, raw: string | undefined): { page: number; pages: number; from: number; to: number } {
  const pages = Math.max(1, Math.ceil(total / REVIEW_PAGE_ROWS));
  const asked = raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : 1;
  const page = asked >= 1 && asked <= pages ? asked : 1;
  const from = total === 0 ? 0 : (page - 1) * REVIEW_PAGE_ROWS + 1;
  return { page, pages, from, to: Math.min(total, page * REVIEW_PAGE_ROWS) };
}

/** Each distinct spelling among included untyped rows, with its count, most rows first. Rows with no text have no spelling. */
export function unmatchedSpellings(rows: ReviewRow[]): { key: string; raw: string; count: number }[] {
  const byKey = new Map<string, { key: string; raw: string; count: number; first: number }>();
  for (const row of [...rows].sort((a, b) => a.position - b.position)) {
    if (row.skipped || row.assetTypeId !== null) continue;
    const key = normalized(row.assetTypeRaw ?? "");
    if (!key) continue;
    const entry = byKey.get(key);
    if (entry) entry.count += 1;
    else byKey.set(key, { key, raw: (row.assetTypeRaw ?? "").trim(), count: 1, first: row.position });
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count || a.first - b.first).map(({ key, raw, count }) => ({ key, raw, count }));
}

/** "Add 3 assets to <site>". */
export const addLabel = (added: number, site: string) => `Add ${plural(added, "asset")} to ${site}`;

/** Why the commit button is disabled. */
export const fixLine = (rows: number) =>
  rows === 1 ? "1 row needs a fix before it can be added" : `${rows} rows need a fix before they can be added`;

/** The line on a committed job. */
export const committedSummary = (added: number, skipped: number) =>
  `Added to site: ${plural(added, "asset")}${skipped > 0 ? `, ${skipped} skipped` : ""}`;
