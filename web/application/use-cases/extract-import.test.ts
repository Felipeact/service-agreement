import { afterEach, describe, expect, test, vi } from "vitest";
import type {
  AssetExtractor,
  AssetTypeCatalog,
  ExtractChunk,
  ExtractedRow,
  ImportJobStore,
  ImportParser,
  ParseResult,
  RecordExtractionResult,
  SourceOfResult,
} from "@/application/ports";
import { makeExtractImport } from "./extract-import";

const JOB = "66666666-6666-4666-8666-666666666666";
const BYTES = new Uint8Array([1, 2, 3]);
const CSV = "text/csv";

const tableOf = (rows: number): ParseResult => ({
  ok: true,
  parsed: {
    format: "table",
    text: "notes",
    tables: [{ source: "Units", header: ["Unit", "Type"], rows: Array.from({ length: rows }, (_, i) => ({ ref: `Units!${i + 2}`, cells: [`U${i}`, "RTU"] })) }],
  },
});

const row = (over: Partial<ExtractedRow> = {}): ExtractedRow => ({
  assetTypeRaw: "RTU",
  unitNo: "1",
  typeModel: null,
  location: null,
  confidence: "high",
  sourceRef: "Units!2",
  ...over,
});

const parsedJob: SourceOfResult = { ok: true, status: "parsed", contentType: CSV, progress: null, result: null, bytes: BYTES };
const extractingJob = (cursor: number, total: number): SourceOfResult => ({
  ok: true,
  status: "extracting",
  contentType: CSV,
  progress: { cursor, total },
  result: null,
  bytes: BYTES,
});

type Setup = {
  source?: SourceOfResult | SourceOfResult[];
  parse?: ParseResult | (() => never);
  answer?: (chunk: ExtractChunk) => ReturnType<AssetExtractor["extract"]>;
  types?: { id: string; code: string; name: string }[] | (() => never);
  record?: RecordExtractionResult;
};

function setup(options: Setup = {}) {
  const sources = Array.isArray(options.source) ? options.source : [options.source ?? parsedJob];
  let served = 0;
  const store = {
    sourceOf: vi.fn(async () => sources[Math.min(served++, sources.length - 1)]),
    recordExtraction: vi.fn(async (...args: [string, number | null, number, unknown[]]): Promise<RecordExtractionResult> =>
      options.record ?? { ok: true, progress: { cursor: 1, total: args[2] }, done: false },
    ),
  };
  const parse = options.parse ?? tableOf(3);
  const parser = { parse: vi.fn(async () => (typeof parse === "function" ? parse() : parse)) };
  const extractor = {
    extract: vi.fn(options.answer ?? (async (chunk: ExtractChunk) => ({ ok: true as const, rows: chunk.kind === "rows" ? chunk.rows.map((r) => row({ sourceRef: r.ref })) : [row()] }))),
  };
  const catalog = {
    list: vi.fn(async () => {
      const types = options.types ?? [{ id: "t-rtu", code: "RTU", name: "RTU" }];
      return typeof types === "function" ? types() : types;
    }),
  };
  const extractImport = makeExtractImport(
    store as unknown as ImportJobStore,
    parser as unknown as ImportParser,
    extractor as unknown as AssetExtractor,
    catalog as unknown as AssetTypeCatalog,
  );
  return { store, parser, extractor, catalog, extractImport };
}

const recorded = (store: ReturnType<typeof setup>["store"]) => store.recordExtraction.mock.calls[0];

afterEach(() => vi.restoreAllMocks());

describe("extractImport", () => {
  test("C504: the first chunk of a 340-row table is 100 rows, recorded with cursor null and total 4", async () => {
    const { store, extractor, extractImport } = setup({ parse: tableOf(340) });

    expect(await extractImport(JOB)).toEqual({ ok: true, state: "extracting", done: 1, total: 4 });
    const sent = extractor.extract.mock.calls[0][0] as ExtractChunk;
    expect(sent.kind === "rows" && sent.rows).toHaveLength(100);
    expect(sent.kind === "rows" && sent.rows[0].ref).toBe("Units!2");
    expect(recorded(store).slice(0, 3)).toEqual([JOB, null, 4]);
    expect(recorded(store)[3]).toHaveLength(100);
  });

  test("C506: fewer rows returned than sent are recorded as returned, and none still advances", async () => {
    const two = setup({ answer: async () => ({ ok: true, rows: [row(), row({ sourceRef: "Units!3" })] }) });
    await two.extractImport(JOB);
    expect(recorded(two.store)[3]).toHaveLength(2);

    const none = setup({ answer: async () => ({ ok: true, rows: [] }) });
    expect(await none.extractImport(JOB)).toMatchObject({ ok: true, state: "extracting" });
    expect(recorded(none.store)).toEqual([JOB, null, 1, []]);
  });

  test("C508: a file with no table is sent as one text chunk and recorded with total 1", async () => {
    const { store, extractor, extractImport } = setup({ parse: { ok: true, parsed: { format: "table", tables: [], text: "Unit 1: RTU" } } });

    await extractImport(JOB);
    expect(extractor.extract).toHaveBeenCalledWith({ kind: "text", text: "Unit 1: RTU" });
    expect(recorded(store).slice(0, 3)).toEqual([JOB, null, 1]);
  });

  test("C509: a pdf is sent as one pdf chunk and recorded with total 1", async () => {
    const { store, extractor, extractImport } = setup({ parse: { ok: true, parsed: { format: "pdf", bytes: BYTES } } });

    await extractImport(JOB);
    expect(extractor.extract).toHaveBeenCalledWith({ kind: "pdf", bytes: BYTES });
    expect(recorded(store).slice(0, 3)).toEqual([JOB, null, 1]);
  });

  test("C513: when the last chunk is recorded the use case answers with the stored counts", async () => {
    const finished: SourceOfResult = { ok: true, status: "extracted", contentType: CSV, progress: { cursor: 1, total: 1 }, result: { rows: 0, unmatched: 0 }, bytes: null };
    const { extractImport } = setup({
      source: [parsedJob, finished],
      answer: async () => ({ ok: true, rows: [] }),
      record: { ok: true, progress: { cursor: 1, total: 1 }, done: true },
    });

    expect(await extractImport(JOB)).toEqual({ ok: true, state: "extracted", rows: 0, unmatched: 0 });
  });

  test.each<[string, string | null, ExtractedRow["confidence"], string | null, ExtractedRow["confidence"]]>([
    ["a ref in the chunk, high", "Units!2", "high", "Units!2", "high"],
    ["a ref in the chunk, medium", "Units!3", "medium", "Units!3", "medium"],
    ["a ref not in the chunk", "Units!99", "high", null, "low"],
    ["a made-up ref", "page 2", "high", null, "low"],
    ["no ref", null, "high", null, "low"],
  ])("C512: a rows chunk with %s", async (_name, sourceRef, confidence, storedRef, storedConfidence) => {
    const { store, extractImport } = setup({ parse: tableOf(2), answer: async () => ({ ok: true, rows: [row({ sourceRef, confidence })] }) });

    await extractImport(JOB);
    expect(recorded(store)[3][0]).toMatchObject({ sourceRef: storedRef, confidence: storedConfidence });
  });

  test.each<[string, { ok: true; parsed: { format: "pdf"; bytes: Uint8Array } } | { ok: true; parsed: { format: "table"; tables: []; text: string } }]>([
    ["a pdf chunk", { ok: true, parsed: { format: "pdf", bytes: BYTES } }],
    ["a text chunk", { ok: true, parsed: { format: "table", tables: [], text: "x" } }],
  ])("C512: %s keeps the ref Claude returned", async (_name, parse) => {
    const { store, extractImport } = setup({ parse, answer: async () => ({ ok: true, rows: [row({ sourceRef: "page 2", confidence: "medium" })] }) });

    await extractImport(JOB);
    expect(recorded(store)[3][0]).toMatchObject({ sourceRef: "page 2", confidence: "medium" });
  });

  test.each<[string, string | null, string | null]>([
    ["surrounding spaces", "  RTU-1 ", "RTU-1"],
    ["empty", "", null],
    ["blank", "   ", null],
    ["null", null, null],
    ["inner spaces", "a  b", "a  b"],
  ])("C514: %s in every text field is stored as %j", async (_name, value, stored) => {
    const { store, extractImport } = setup({
      parse: { ok: true, parsed: { format: "pdf", bytes: BYTES } },
      answer: async () => ({ ok: true, rows: [row({ assetTypeRaw: value, unitNo: value, typeModel: value, location: value, sourceRef: value })] }),
    });

    await extractImport(JOB);
    expect(recorded(store)[3][0]).toMatchObject({ assetTypeRaw: stored, unitNo: stored, typeModel: stored, location: stored, sourceRef: stored });
  });

  test("C518: the types come from the catalog, read once per call, and no other source", async () => {
    const { store, catalog, extractImport } = setup({
      types: [{ id: "t-mua", code: "MUA", name: "Fresh Air" }],
      answer: async () => ({ ok: true, rows: [row({ assetTypeRaw: "MAU" }), row({ assetTypeRaw: "Rooftop unit" })] }),
    });

    await extractImport(JOB);
    expect(catalog.list).toHaveBeenCalledTimes(1);
    expect((recorded(store)[3] as { assetTypeId: string | null }[]).map((r) => r.assetTypeId)).toEqual(["t-mua", null]);
  });

  test("C519: the raw wording is kept, trimmed, whatever type was matched", async () => {
    const { store, extractImport } = setup({
      types: [{ id: "t-rtu", code: "RTU", name: "Packaged Equipment" }],
      answer: async () => ({ ok: true, rows: [row({ assetTypeRaw: "Rooftop unit " })] }),
    });

    await extractImport(JOB);
    expect(recorded(store)[3][0]).toMatchObject({ assetTypeRaw: "Rooftop unit", assetTypeId: "t-rtu" });
  });

  test("C523: an extracting job at cursor 2 sends only the third chunk and records against cursor 2", async () => {
    const { store, extractor, extractImport } = setup({ source: extractingJob(2, 4), parse: tableOf(340), record: { ok: true, progress: { cursor: 3, total: 4 }, done: false } });

    expect(await extractImport(JOB)).toEqual({ ok: true, state: "extracting", done: 3, total: 4 });
    expect(extractor.extract).toHaveBeenCalledTimes(1);
    const sent = extractor.extract.mock.calls[0][0] as ExtractChunk;
    const refs = sent.kind === "rows" ? sent.rows.map((r) => r.ref) : [];
    expect(refs[0]).toBe("Units!202");
    expect(refs.at(-1)).toBe("Units!301");
    expect(recorded(store).slice(0, 3)).toEqual([JOB, 2, 4]);
  });

  test("C526: an extracted job answers from its stored result and calls nothing else", async () => {
    const { store, parser, catalog, extractor, extractImport } = setup({
      source: { ok: true, status: "extracted", contentType: CSV, progress: { cursor: 4, total: 4 }, result: { rows: 338, unmatched: 14 }, bytes: null },
    });

    expect(await extractImport(JOB)).toEqual({ ok: true, state: "extracted", rows: 338, unmatched: 14 });
    expect(parser.parse).not.toHaveBeenCalled();
    expect(catalog.list).not.toHaveBeenCalled();
    expect(extractor.extract).not.toHaveBeenCalled();
    expect(store.recordExtraction).not.toHaveBeenCalled();
  });

  test.each(["uploading", "uploaded", "unreadable"] as const)("C528: a job %s is not_ready and nothing runs", async (status) => {
    const { store, parser, catalog, extractor, extractImport } = setup({ source: { ok: true, status, contentType: CSV, progress: null, result: null, bytes: null } });

    expect(await extractImport(JOB)).toEqual({ ok: false, code: "not_ready" });
    expect(parser.parse).not.toHaveBeenCalled();
    expect(catalog.list).not.toHaveBeenCalled();
    expect(extractor.extract).not.toHaveBeenCalled();
    expect(store.recordExtraction).not.toHaveBeenCalled();
  });

  test.each<[string, Setup, boolean]>([
    ["sourceOf is unavailable", { source: { ok: false, code: "unavailable" } }, false],
    ["the parser throws", { parse: () => { throw new Error("boom"); } }, true],
    ["the parser no longer reads the file", { parse: { ok: false, reason: "corrupt" } }, true],
    ["the catalog throws", { types: () => { throw new Error("db down"); } }, true],
    ["the extractor is unavailable", { answer: async () => ({ ok: false, code: "unavailable" }) }, false],
    ["recordExtraction is unavailable", { record: { ok: false, code: "unavailable" } }, false],
  ])("C529: when %s the answer is unavailable", async (name, options, logs) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { store, extractImport } = setup(options);

    expect(await extractImport(JOB)).toEqual({ ok: false, code: "unavailable" });
    if (name !== "recordExtraction is unavailable") expect(store.recordExtraction).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(logs ? 1 : 0);
    if (logs) expect(String(log.mock.calls[0][0])).toContain(JOB);
  });

  test.each<[string, Setup, boolean]>([
    ["an extracted job has no stored result", { source: { ok: true, status: "extracted", contentType: CSV, progress: null, result: null, bytes: null } }, false],
    ["no chunk sits at the stored cursor", { source: extractingJob(5, 6) }, true],
    [
      "the re-read after the last chunk is not extracted",
      { source: [parsedJob, extractingJob(1, 1)], record: { ok: true, progress: { cursor: 1, total: 1 }, done: true } },
      false,
    ],
  ])("use case: when %s the answer is unavailable", async (_name, options, logs) => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { extractImport } = setup(options);

    expect(await extractImport(JOB)).toEqual({ ok: false, code: "unavailable" });
    expect(log).toHaveBeenCalledTimes(logs ? 1 : 0);
  });

  test("C531: a too_large answer is returned and nothing is recorded", async () => {
    const { store, extractImport } = setup({ parse: { ok: true, parsed: { format: "pdf", bytes: BYTES } }, answer: async () => ({ ok: false, code: "too_large" }) });

    expect(await extractImport(JOB)).toEqual({ ok: false, code: "too_large" });
    expect(store.recordExtraction).not.toHaveBeenCalled();
  });
});
