import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { CatalogDrafter, DraftInput } from "@/application/ports";
import { makeDraftCatalog } from "@/application/use-cases/draft-catalog";
import { importParser } from ".";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const fixture = (name: string) => new Uint8Array(readFileSync(join(__dirname, "fixtures", name)));

describe("makeDraftCatalog with the importer's real parser", () => {
  test("C3409: a DOCX is read by the importer's parser and reaches the drafter as its text", async () => {
    const inputs: DraftInput[] = [];
    const drafter: CatalogDrafter = {
      draft: async (input) => (inputs.push(input), { ok: true, types: [{ name: "Boiler", defaultVisitMonths: [10], synonyms: [], tasks: [{ description: "Check" }] }] }),
    };
    const outcome = await makeDraftCatalog({ parser: importParser, drafter })({ file: { contentType: DOCX, bytes: fixture("text-only.docx") } });
    expect(outcome.ok).toBe(true);
    expect(inputs).toHaveLength(1);
    const document = inputs[0].document;
    expect(document?.kind).toBe("text");
    expect(document?.kind === "text" && document.text).toContain("Boiler room has two Lochinvar boilers");
  });

  test("C3413: a blank DOCX and a corrupt one are unreadable through the real parser and Claude is not called", async () => {
    const inputs: DraftInput[] = [];
    const drafter: CatalogDrafter = { draft: async (input) => (inputs.push(input), { ok: false, code: "unavailable" }) };
    const draft = makeDraftCatalog({ parser: importParser, drafter });
    for (const bytes of [fixture("blank.docx"), new Uint8Array([1, 2, 3, 4]), new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0])]) {
      expect(await draft({ file: { contentType: DOCX, bytes } })).toEqual({ ok: false, error: "unreadable", reason: "unreadable" });
    }
    expect(inputs).toHaveLength(0);
  });
});
