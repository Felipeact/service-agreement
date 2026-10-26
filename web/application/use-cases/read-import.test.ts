import { afterEach, describe, expect, test, vi } from "vitest";
import type { ImportFileResult, ImportJobStore, ImportParser, ParseResult, ParsedTable } from "@/application/ports";
import type { ReadOutcome } from "@/domain/imports";
import { makeReadImport } from "./read-import";

const JOB = "66666666-6666-4666-8666-666666666666";
const BYTES = new Uint8Array([1, 2, 3]);
const CSV = "text/csv";

const table = (rows: number): ParsedTable => ({
  source: "CSV",
  header: ["Unit", "Type"],
  rows: Array.from({ length: rows }, (_, i) => ({ ref: `CSV!${i + 2}`, cells: [`U${i}`, "RTU"] })),
});

function setup(file: ImportFileResult, parse: ParseResult | (() => never) = { ok: true, parsed: { format: "table", tables: [], text: "x" } }) {
  const store = {
    fileOf: vi.fn(async () => file),
    recordRead: vi.fn(async (_id: string, outcome: ReadOutcome) => ({ ok: true as const, outcome })),
  } as unknown as ImportJobStore & { fileOf: ReturnType<typeof vi.fn>; recordRead: ReturnType<typeof vi.fn> };
  const parser = { parse: vi.fn(async () => (typeof parse === "function" ? parse() : parse)) } as ImportParser & { parse: ReturnType<typeof vi.fn> };
  return { store, parser, readImport: makeReadImport(store, parser) };
}

const uploaded: ImportFileResult = { ok: true, status: "uploaded", contentType: CSV, outcome: null, bytes: BYTES };

afterEach(() => vi.restoreAllMocks());

describe("readImport", () => {
  test.each<[string, ParseResult, ReadOutcome]>([
    ["two tables", { ok: true, parsed: { format: "table", tables: [table(3), table(4)], text: "" } }, { status: "parsed", tables: 2, rows: 7 }],
    ["no table", { ok: true, parsed: { format: "table", tables: [], text: "Boiler room" } }, { status: "parsed", tables: 0, rows: 0 }],
    ["pdf", { ok: true, parsed: { format: "pdf", bytes: BYTES } }, { status: "parsed", tables: null, rows: null }],
    ["unreadable", { ok: false, reason: "no_table" }, { status: "unreadable", reason: "no_table" }],
  ])("C463: %s is recorded as its outcome, once", async (_name, parse, outcome) => {
    const { store, parser, readImport } = setup(uploaded, parse);

    expect(await readImport(JOB)).toEqual({ ok: true, outcome });
    expect(parser.parse).toHaveBeenCalledWith(CSV, BYTES);
    expect(store.recordRead).toHaveBeenCalledTimes(1);
    expect(store.recordRead).toHaveBeenCalledWith(JOB, outcome);
  });

  test.each<[ReadOutcome]>([[{ status: "parsed", tables: 1, rows: 48 }], [{ status: "unreadable", reason: "corrupt" }]])(
    "C473: a job already read (%o) returns its stored outcome without parsing or writing",
    async (outcome) => {
      const { store, parser, readImport } = setup({ ok: true, status: outcome.status, contentType: CSV, outcome, bytes: null });

      expect(await readImport(JOB)).toEqual({ ok: true, outcome });
      expect(parser.parse).not.toHaveBeenCalled();
      expect(store.recordRead).not.toHaveBeenCalled();
    },
  );

  test("C476: a job still uploading is not_ready, and nothing is parsed or written", async () => {
    const { store, parser, readImport } = setup({ ok: true, status: "uploading", contentType: CSV, outcome: null, bytes: null });

    expect(await readImport(JOB)).toEqual({ ok: false, code: "not_ready" });
    expect(parser.parse).not.toHaveBeenCalled();
    expect(store.recordRead).not.toHaveBeenCalled();
  });

  test("C477: a parser that throws gives unavailable, logs once, and writes no outcome", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { store, readImport } = setup(uploaded, () => {
      throw new Error("out of memory");
    });

    expect(await readImport(JOB)).toEqual({ ok: false, code: "unavailable" });
    expect(store.recordRead).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledTimes(1);
  });

  test("C477: a failed download (unavailable from the store) writes no outcome", async () => {
    const { store, parser, readImport } = setup({ ok: false, code: "unavailable" });

    expect(await readImport(JOB)).toEqual({ ok: false, code: "unavailable" });
    expect(parser.parse).not.toHaveBeenCalled();
    expect(store.recordRead).not.toHaveBeenCalled();
  });
});
