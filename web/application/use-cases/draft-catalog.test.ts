import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import type { CatalogDrafter, DraftInput, DraftResult, ImportParser } from "@/application/ports";
import { importParser } from "@/infrastructure/import-parsers";
import { makeDraftCatalog } from "./draft-catalog";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, "../../infrastructure/import-parsers/fixtures", name)));
const GOOD: DraftResult = {
  ok: true,
  types: [{ name: "Pool pump", defaultVisitMonths: [4, 10], synonyms: [], tasks: [{ description: "Check seals" }] }],
  usage: { inputTokens: 1200, outputTokens: 340 },
};

function setup(result: DraftResult = GOOD, parser: ImportParser = importParser) {
  const inputs: DraftInput[] = [];
  const drafter: CatalogDrafter = { draft: async (input) => (inputs.push(input), result) };
  return { inputs, draft: makeDraftCatalog({ parser, drafter }) };
}

afterEach(() => vi.restoreAllMocks());

describe("makeDraftCatalog", () => {
  test("C3409: a DOCX is read by the importer's parser and reaches the drafter as its text", async () => {
    const { inputs, draft } = setup();
    const outcome = await draft({ file: { contentType: DOCX, bytes: fixture("text-only.docx") } });
    expect(outcome.ok).toBe(true);
    expect(inputs).toHaveLength(1);
    const document = inputs[0].document;
    expect(document?.kind).toBe("text");
    expect(document?.kind === "text" && document.text).toContain("Boiler room has two Lochinvar boilers");
  });

  test("C3410: a file and a description go together; either alone goes alone", async () => {
    const both = setup();
    await both.draft({ description: "  pools  ", file: { contentType: DOCX, bytes: fixture("text-only.docx") } });
    expect(both.inputs[0].description).toBe("pools");
    expect(both.inputs[0].document?.kind).toBe("text");

    const fileOnly = setup();
    await fileOnly.draft({ file: { contentType: "application/pdf", bytes: new TextEncoder().encode("%PDF-1.7\n%%EOF") } });
    expect(fileOnly.inputs[0].description).toBeUndefined();
    expect(fileOnly.inputs[0].document?.kind).toBe("pdf");

    const textOnly = setup();
    await textOnly.draft({ description: "pools" });
    expect(textOnly.inputs[0]).toEqual({ description: "pools" });
  });

  test("C3413: a file the parser refuses is unreadable and Claude is not called", async () => {
    const cases: [string, Uint8Array, string][] = [
      ["corrupt docx", new Uint8Array([1, 2, 3, 4]), DOCX],
      ["password protected docx", new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0]), DOCX],
      ["docx with no text", fixture("blank.docx"), DOCX],
      ["pdf with no mark", new Uint8Array([1, 2, 3]), "application/pdf"],
    ];
    for (const [label, bytes, contentType] of cases) {
      const { inputs, draft } = setup();
      const outcome = await draft({ file: { contentType, bytes } });
      expect(outcome, label).toEqual({ ok: false, error: "unreadable", reason: "unreadable" });
      expect(inputs, label).toHaveLength(0);
    }
  });

  test("C3413: a parsed Word file whose text is only whitespace is unreadable", async () => {
    const parser: ImportParser = { parse: async () => ({ ok: true, parsed: { format: "table", tables: [], text: "   \n " } }) };
    const { inputs, draft } = setup(GOOD, parser);
    expect(await draft({ file: { contentType: DOCX, bytes: new Uint8Array([1]) } })).toEqual({ ok: false, error: "unreadable", reason: "unreadable" });
    expect(inputs).toHaveLength(0);
  });

  test("C3415: nothing the owner sent is logged, and a success logs one line with the count and the token usage", async () => {
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => {}));
    const secret = "PRIVATE-DESCRIPTION-xyz";
    const { draft } = setup();
    await draft({ description: secret, file: { contentType: DOCX, bytes: fixture("text-only.docx") } });
    const lines = spies.flatMap((spy) => spy.mock.calls.map((call) => call.join(" ")));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("1 type");
    expect(lines[0]).toContain("1200");
    expect(lines[0]).toContain("340");
    for (const text of [secret, "Lochinvar", "Pool pump", "Check seals"]) expect(lines.join("\n")).not.toContain(text);

    const failed = setup({ ok: false, code: "unavailable" });
    await failed.draft({ description: secret });
    const after = spies.flatMap((spy) => spy.mock.calls.map((call) => call.join(" ")));
    expect(after.join("\n")).not.toContain(secret);
  });

  test("C3415: the use case is built from a parser and a drafter only, so it has no store to keep a file in", () => {
    expect(makeDraftCatalog.length).toBe(1);
    const source = readFileSync(join(__dirname, "draft-catalog.ts"), "utf8");
    expect(source).not.toMatch(/storage|bucket|upload/i);
  });
});
