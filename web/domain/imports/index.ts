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

/** An org type as matching sees it: its own spellings (`asset_types.synonyms`) are other ways a list writes it. */
export type AssetTypeRef = { id: string; code: string; name: string; synonyms: string[] };

/** Words a list adds around a type's name; they never decide a match. */
const STOP_WORDS = new Set(["a", "an", "the", "of", "and", "for", "with"]);

/**
 * Short forms lists use for a whole family of equipment. A token on the left also counts as the word on the right, so
 * "Backflow DCVA 2in" reads as a backflow preventer. Kept small and literal: an alias is only worth adding when the
 * short form means one thing across trades.
 */
const ALIASES: Record<string, string> = { dcva: "backflow", rpz: "backflow", rpza: "backflow", dcda: "backflow", pvb: "backflow", bf: "backflow", vrv: "vrf" };

/** Words that qualify a type without changing what it is. Short on purpose: a word is only here when it never names other equipment. */
const QUALIFIERS = new Set(["condensing", "high", "low", "efficiency", "gas", "electric", "fired", "inline"]);

/** Words that may stand in brackets after a type name without changing it: the qualifiers and a few plain descriptors. */
const DESCRIPTORS = new Set(["condensing", "high", "low", "efficiency", "gas", "electric", "water", "cooled", "air", "roof", "indoor", "outdoor", "new", "old", "spare", "standard"]);

/** "dampers" and "damper" are one word: a trailing plural s goes, except where it belongs to the word ("gas", "glass", "bus"). */
const singular = (token: string): string => (token.length > 3 && token.endsWith("s") && !/(ss|us|is)$/.test(token) ? token.slice(0, -1) : token);

const tokensOf = (text: string): string[] =>
  normalized(text)
    .split(" ")
    .filter((token) => token !== "" && !STOP_WORDS.has(token))
    .map(singular);

/**
 * French wording lists use, as the English the catalog's types are named in. Matched on the list's text with accents and
 * punctuation taken out; the longest phrase first, so "pompe de puisard" is not read as "pump".
 */
const FRENCH: [string, string][] = [
  ["ventilateur d extraction", "exhaust fan"],
  ["ventilateur de soufflage", "supply fan"],
  ["ventilo convecteur", "fan coil"],
  ["registre coupe feu", "fire damper"],
  ["aerotherme au gaz", "gas unit heater"],
  ["aerotherme electrique", "electric unit heater"],
  ["recuperateur d energie", "energy recovery ventilator"],
  ["recuperateur de chaleur", "heat recovery ventilator"],
  ["tour de refroidissement", "cooling tower"],
  ["echangeur de chaleur", "heat exchanger"],
  ["separateur d air", "air separator"],
  ["vase d expansion", "expansion tank"],
  ["reservoir d expansion", "expansion tank"],
  ["reservoir de stockage", "storage tank"],
  ["dispositif antirefoulement", "backflow preventer"],
  ["clapet anti retour", "backflow preventer"],
  ["machine a glacons", "ice machine"],
  ["chambre froide", "walk in cooler"],
  ["chambre congelee", "walk in freezer"],
  ["unite de toit", "rooftop unit"],
  ["unite de traitement d air", "air handling unit"],
  ["thermopompe eau", "water source heat pump"],
  ["refroidisseur", "chiller"],
  ["chaudiere", "boiler"],
  ["fournaise", "furnace"],
  ["pompe", "pump"],
  ["crepine", "wye strainer"],
];

const stripAccents = (text: string): string => text.normalize("NFD").replace(/\p{M}+/gu, "");

/** The text matching reads: the list's own when it has no French phrase and no "in-line", else its English wording without punctuation. */
function inEnglish(raw: string): string {
  const english = englishOf(raw);
  const plain = stripAccents(raw).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return english !== plain ? english : raw;
}

/** The list's text with French phrases turned into the English the types use, and "in-line" written as one word. */
function englishOf(raw: string): string {
  let flat = stripAccents(raw).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/(^| )in line( |$)/g, "$1inline$2");
  for (const [french, english] of FRENCH) flat = (" " + flat + " ").replace(" " + french + " ", " " + english + " ").trim();
  return flat;
}

/** A list's token is a type word when it is that word, its start ("exh" for exhaust), or its consonant skeleton ("chlr" for chiller). */
function fitsWord(token: string, word: string): boolean {
  if (token === word) return true;
  if (token.length < 3 || token.length >= word.length) return false;
  if (word.startsWith(token)) return true;
  if (token.length < 4 || token[0] !== word[0]) return false;
  let at = 0;
  for (const letter of word) if (letter === token[at]) at += 1;
  return at === token.length;
}

/**
 * The org's type a list's wording means, or `null`. A code or name wins; then a spelling one of the org's own types holds;
 * then the words: every word of a type's name found in the list's text (as itself, a short form, or an alias), the type
 * with the most words winning, else the one type whose first word (five letters or more) the text holds. Blank text, no
 * match and a tie all give `null`: a guess would hide a row the review must see.
 */
export function matchAssetType(rawText: string | null, types: AssetTypeRef[]): string | null {
  const raw = rawText === null ? null : inEnglish(rawText);
  const wanted = normalized(raw ?? "");
  if (!wanted) return null;
  const direct = new Set(types.filter((t) => normalized(t.code) === wanted || normalized(t.name) === wanted).map((t) => t.id));
  if (direct.size > 0) return direct.size === 1 ? [...direct][0] : null;
  const viaSynonym = new Set(
    types.filter((t) => t.synonyms.some((synonym) => normalized(synonym) === wanted)).map((t) => t.id),
  );
  if (viaSynonym.size > 0) return viaSynonym.size === 1 ? [...viaSynonym][0] : null;

  // A code in brackets after the spelled-out name ("Energy recovery ventilator (ERV)") names the type, unless the text before it
  // names another one.
  const bracketCodes = [...(raw ?? "").matchAll(/[(]([^)]*)[)]/g)].map((found) => normalized(found[1])).filter((word) => word !== "");
  if (bracketCodes.length > 0) {
    const exact = (words: string[]) =>
      new Set(types.filter((t) => words.some((word) => normalized(t.code) === word || normalized(t.name) === word || t.synonyms.some((synonym) => normalized(synonym) === word))).map((t) => t.id));
    const inBrackets = exact(bracketCodes);
    const before = exact([normalized((raw ?? "").replace(/[(][^)]*[)]/g, " "))]);
    if (inBrackets.size === 1 && (before.size === 0 || (before.size === 1 && [...before][0] === [...inBrackets][0]))) return [...inBrackets][0];
  }

  // Sizes and counts ("2in", "4") say nothing about the type. Words inside brackets are a qualifier ("Boiler (condensing)") only when
  // each is a plain descriptor: "Boiler (feed pump)" is a pump, so any other bracketed word leaves the row for the review.
  const outside = (raw ?? "").replace(/\([^)]*\)/g, " ");
  const bracketed = [...(raw ?? "").matchAll(/\(([^)]*)\)/g)].flatMap((found) => tokensOf(found[1]));
  if (bracketed.some((token) => !/^\d/.test(token) && !DESCRIPTORS.has(token))) return null;
  const dotted = new Set([...outside.matchAll(/(\p{L}+)\./gu)].map((found) => found[1].toLowerCase()));
  const spoken = tokensOf(outside).filter((token) => !/^\d/.test(token));
  const heard = [...new Set([...spoken, ...spoken.flatMap((token) => (ALIASES[token] ? [ALIASES[token]] : []))])];
  if (heard.length === 0) return null;
  // A word the text adds is harmless only when it is explained for this type: an alias of a word the type has ("rpz" on a backflow
  // type, never on a pump), a plain qualifier, or a period-marked short form of a qualifier ("cond."). Any other extra word
  // ("feed pump", "coil", "sump", "pump.") means a different kind of equipment than the type.
  const unexplained = (words: string[]) =>
    spoken.filter(
      (token) =>
        !words.some((word) => fitsWord(token, word)) &&
        !(ALIASES[token] && words.includes(ALIASES[token])) &&
        !QUALIFIERS.has(token) &&
        !(dotted.has(token) && [...QUALIFIERS].some((qualifier) => fitsWord(token, qualifier))),
    );
  const named = types.map((t) => ({ id: t.id, words: tokensOf(t.name) })).filter((t) => t.words.length > 0);
  const whole = named.filter((t) => t.words.every((word) => heard.some((token) => fitsWord(token, word))) && unexplained(t.words).length === 0);
  const best = Math.max(0, ...whole.map((t) => t.words.length));
  const top = whole.filter((t) => t.words.length === best);
  if (top.length > 0) return top.length === 1 ? top[0].id : null;
  const byHead = named.filter((t) => t.words[0].length >= 5 && heard.includes(t.words[0]) && unexplained(t.words).length === 0);
  if (byHead.length === 1) return byHead[0].id;
  // A lone short form that is an alias ("vrv" for VRF) names the one type whose first word it stands for.
  if (spoken.length === 1 && ALIASES[spoken[0]]) {
    const byAlias = named.filter((t) => t.words[0] === ALIASES[spoken[0]]);
    return byAlias.length === 1 ? byAlias[0].id : null;
  }
  return null;
}

/** A row that stands for several units: "VAV boxes (qty 24)", "Exhaust fans x6", "24 x VAV boxes". Two to fifty, else a count we do not trust. */
export const MAX_ROW_QUANTITY = 50;

export function splitQuantity(raw: string | null): { label: string; qty: number } | null {
  const text = (raw ?? "").trim();
  const patterns = [/\(?\s*(?:qty|quantity)\s*[:=]?\s*(\d+)\s*\)?/i, /\(?\s*[x×]\s*(\d+)\s*\)?\s*$/i, /^\s*[x×]\s*(\d+)\s+/i, /^\s*(\d+)\s*[x×]\s+/i];
  for (const pattern of patterns) {
    const found = pattern.exec(text);
    if (!found) continue;
    const qty = Number(found[1]);
    const label = text.replace(pattern, " ").replace(/\s+/g, " ").trim();
    if (qty >= 2 && qty <= MAX_ROW_QUANTITY && label !== "") return { label, qty };
  }
  // A plural type name then a bare number ("Fire dampers 40"): a count, since a unit's number follows a singular name ("Boiler 2").
  const bare = /^(.*\p{L})s\s+(\d+)$/iu.exec(text);
  if (bare && !/[sui]$/i.test(bare[1])) {
    const qty = Number(bare[2]);
    const label = `${bare[1]}s`.trim();
    if (qty >= 2 && qty <= MAX_ROW_QUANTITY && label !== "") return { label, qty };
  }
  return null;
}

/** The header names a list uses for a count column, as `normalized` writes them. */
const QUANTITY_HEADERS = new Set(["qty", "quantity", "count", "units", "no of units", "number of units", "nb", "qte", "quantite", "nombre"]);

/** The index of the count column of a table's header, `null` when it has none. */
export function quantityColumn(header: string[]): number | null {
  const at = header.findIndex((name) => QUANTITY_HEADERS.has(normalized(name)));
  return at >= 0 ? at : null;
}

/** The count a cell holds ("18", "x18", "18 units"), two to fifty, else `null`: one unit, or a number we do not trust. */
export function quantityOf(cell: string | null | undefined): number | null {
  const found = /^\s*[x×]?\s*(\d+)\s*(?:units?|pcs|ea)?\s*$/i.exec(cell ?? "");
  const qty = found ? Number(found[1]) : NaN;
  return qty >= 2 && qty <= MAX_ROW_QUANTITY ? qty : null;
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

/** The statuses a job can be listed by; `attention` is the jobs that need someone to act (upload not finished, file unreadable). */
export const IMPORT_STATUS_FILTERS = ["attention", "uploaded", "parsed", "unreadable", "extracting", "extracted", "committed"] as const;
export type ImportStatusFilter = (typeof IMPORT_STATUS_FILTERS)[number];

/** The statuses `attention` stands for. */
export const ATTENTION_STATUSES = ["uploading", "unreadable"] as const;

export type ImportFilter = { status?: ImportStatusFilter; siteId?: string };

type ImportParams = { status?: string | string[]; site?: string | string[] };

const single = (value: string | string[] | undefined): string | undefined => (typeof value === "string" ? value : undefined);

/** The filter a URL asks for; a value that is not valid is dropped, never an error (imports-page AC 11). */
export function parseImportFilter(params: ImportParams): ImportFilter {
  const status = single(params.status);
  const site = single(params.site);
  return {
    ...(status && (IMPORT_STATUS_FILTERS as readonly string[]).includes(status) && { status: status as ImportStatusFilter }),
    ...(site && isUuid(site) && { siteId: site }),
  };
}
