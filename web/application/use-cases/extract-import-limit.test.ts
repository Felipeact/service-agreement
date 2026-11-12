import { afterEach, describe, expect, test, vi } from "vitest";
import type {
  AssetExtractor,
  AssetTypeCatalog,
  ImportAllowance,
  ImportAllowanceResult,
  ImportJobStore,
  ImportParser,
  ParseResult,
  RecordExtractionResult,
  SourceOfResult,
} from "@/application/ports";
import { makeExtractImport } from "./extract-import";

const JOB = "66666666-6666-4666-8666-666666666666";
const BYTES = new Uint8Array([1, 2, 3]);

const table: ParseResult = {
  ok: true,
  parsed: { format: "table", text: "notes", tables: [{ source: "Units", header: ["Unit", "Type"], rows: Array.from({ length: 250 }, (_, i) => ({ ref: `Units!${i + 2}`, cells: [`U${i}`, "RTU"] })) }] },
};
const parsedJob: SourceOfResult = { ok: true, status: "parsed", contentType: "text/csv", progress: null, result: null, bytes: BYTES };
const startedJob: SourceOfResult = { ok: true, status: "extracting", contentType: "text/csv", progress: { cursor: 1, total: 3 }, result: null, bytes: BYTES };
const REFUSED: ImportAllowanceResult = { ok: true, allowed: false, plan: "starter", limit: 10, used: 10, resetsOn: "2026-12-01" };

function setup(source: SourceOfResult, check: () => Promise<ImportAllowanceResult>) {
  const store = {
    sourceOf: vi.fn(async () => source),
    recordExtraction: vi.fn(async (): Promise<RecordExtractionResult> => ({ ok: true, progress: { cursor: 1, total: 3 }, done: false })),
  };
  const parser = { parse: vi.fn(async () => table) };
  const extractor = { extract: vi.fn(async () => ({ ok: true as const, rows: [] })) };
  const catalog = { list: vi.fn(async () => []), tradeContext: vi.fn(async () => null) };
  const allowance = { check: vi.fn(check) };
  const extractImport = makeExtractImport(
    store as unknown as ImportJobStore,
    parser as unknown as ImportParser,
    extractor as unknown as AssetExtractor,
    catalog as unknown as AssetTypeCatalog,
    allowance as unknown as ImportAllowance,
  );
  return { store, extractor, allowance, extractImport };
}

afterEach(() => vi.restoreAllMocks());

describe("extractImport and the AI-import allowance", () => {
  test("C5125: a refused allowance on the first chunk answers plan_limit, calls no extractor and records nothing", async () => {
    const { extractImport, extractor, store, allowance } = setup(parsedJob, async () => REFUSED);
    expect(await extractImport(JOB)).toEqual({ ok: false, code: "plan_limit", plan: "starter", limit: 10, used: 10, resetsOn: "2026-12-01" });
    expect(allowance.check).toHaveBeenCalledTimes(1);
    expect(allowance.check).toHaveBeenCalledWith(JOB);
    expect(extractor.extract).toHaveBeenCalledTimes(0);
    expect(store.recordExtraction).toHaveBeenCalledTimes(0);
  });

  test("C5125: an allowed first chunk calls the extractor once, after the allowance was asked", async () => {
    const order: string[] = [];
    const { extractImport, extractor, allowance } = setup(parsedJob, async () => {
      order.push("allowance");
      return { ok: true, allowed: true };
    });
    extractor.extract.mockImplementation(async () => {
      order.push("extractor");
      return { ok: true as const, rows: [] };
    });
    expect(await extractImport(JOB)).toMatchObject({ ok: true, state: "extracting" });
    expect(allowance.check).toHaveBeenCalledTimes(1);
    expect(extractor.extract).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["allowance", "extractor"]);
  });

  test("C5126: a job with stored progress never asks the allowance and still extracts", async () => {
    const { extractImport, extractor, allowance } = setup(startedJob, async () => REFUSED);
    expect(await extractImport(JOB)).toMatchObject({ ok: true, state: "extracting" });
    expect(allowance.check).toHaveBeenCalledTimes(0);
    expect(extractor.extract).toHaveBeenCalledTimes(1);
  });

  test("C5127: an allowance read that throws, or answers unavailable, is unavailable and calls no extractor", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const thrown = setup(parsedJob, async () => {
      throw new Error("down");
    });
    expect(await thrown.extractImport(JOB)).toEqual({ ok: false, code: "unavailable" });
    expect(thrown.extractor.extract).toHaveBeenCalledTimes(0);

    const unavailable = setup(parsedJob, async () => ({ ok: false, code: "unavailable" }));
    expect(await unavailable.extractImport(JOB)).toEqual({ ok: false, code: "unavailable" });
    expect(unavailable.extractor.extract).toHaveBeenCalledTimes(0);
  });
});
