import { describe, expect, test, vi } from "vitest";
import type { AddDraftResult, CatalogDrafter, CatalogWriter, DraftResult, ImportParser, ParseResult } from "@/application/ports";
import type { Role } from "@/domain/members";
import { makeAcceptCatalogDraft, makeDraftCatalog, MAX_DRAFT_FILE_BYTES } from "./draft-catalog";

const goodType = { name: "Termite inspection", months: [3, 9], tasks: ["Check bait stations"] };

function setup(over: { size?: number; sizeError?: boolean; parsed?: ParseResult; drafted?: DraftResult } = {}) {
  const draft = vi.fn<CatalogDrafter["draft"]>(async () => over.drafted ?? { ok: true, types: [goodType] });
  const parse = vi.fn<ImportParser["parse"]>(async () => over.parsed ?? { ok: true, parsed: { format: "table", tables: [], text: "Rodent stations: monthly" } });
  const catalogSize = vi.fn(async () => {
    if (over.sizeError) throw new Error("db down");
    return over.size ?? 0;
  });
  const run = makeDraftCatalog(catalogSize, { parse }, { draft });
  return { run, draft, parse, catalogSize };
}

const ask = (over: Partial<Parameters<ReturnType<typeof setup>["run"]>[0]> = {}) => ({ role: "owner" as Role | null, trade: "pest control", notes: "", ...over });

describe("draftCatalog", () => {
  test("C4101: a valid trade from an owner or an admin of an empty catalog calls the drafter once and returns the draft", async () => {
    for (const role of ["owner", "admin"] as const) {
      const { run, draft } = setup();
      expect(await run(ask({ role }))).toEqual({ ok: true, trade: "pest control", types: [goodType] });
      expect(draft).toHaveBeenCalledTimes(1);
      expect(draft).toHaveBeenCalledWith({ trade: "pest control", notes: "", file: undefined });
    }
  });

  test("C4103: an empty, 61-character or semicolon trade is invalid and nothing is called", async () => {
    for (const trade of ["", "a".repeat(61), "pest;control"]) {
      const { run, draft, catalogSize } = setup();
      expect(await run(ask({ trade })), trade).toEqual({ ok: false, code: "invalid" });
      expect(draft).not.toHaveBeenCalled();
      expect(catalogSize).not.toHaveBeenCalled();
    }
  });

  test("C4106: an estimator, a viewer and a user with no membership are forbidden and the drafter is never called", async () => {
    for (const role of ["estimator", "viewer", null] as const) {
      const { run, draft } = setup();
      expect(await run(ask({ role })), String(role)).toEqual({ ok: false, code: "forbidden" });
      expect(draft).not.toHaveBeenCalled();
    }
  });

  test("C4107: an org that already has a type is not_empty and the drafter is never called", async () => {
    const { run, draft } = setup({ size: 1 });
    expect(await run(ask())).toEqual({ ok: false, code: "not_empty" });
    expect(draft).not.toHaveBeenCalled();
  });

  test("C4110: a read file's text, or a pdf's bytes, reaches the drafter; every accepted file type is parsed first", async () => {
    const text = setup();
    await text.run(ask({ file: { name: "proposal.docx", bytes: new Uint8Array([1]) } }));
    expect(text.draft).toHaveBeenCalledWith({ trade: "pest control", notes: "", file: { kind: "text", text: "Rodent stations: monthly" } });

    const pdf = setup({ parsed: { ok: true, parsed: { format: "pdf", bytes: new Uint8Array([37, 80]) } } });
    await pdf.run(ask({ file: { name: "proposal.PDF", bytes: new Uint8Array([37, 80]) } }));
    expect(pdf.draft).toHaveBeenCalledWith({ trade: "pest control", notes: "", file: { kind: "pdf", bytes: new Uint8Array([37, 80]) } });

    for (const name of ["a.xlsx", "a.csv", "a.docx", "a.pdf"]) {
      const { run, parse } = setup();
      await run(ask({ file: { name, bytes: new Uint8Array(MAX_DRAFT_FILE_BYTES) } }));
      expect(parse, name).toHaveBeenCalledTimes(1);
    }
  });

  test("C4111: another type, 4,194,305 bytes, an empty file or a file the parser cannot read never reach the drafter", async () => {
    const cases: [string, Uint8Array, ParseResult | undefined, string][] = [
      ["notes.txt", new Uint8Array([1]), undefined, "unreadable"],
      ["big.pdf", new Uint8Array(MAX_DRAFT_FILE_BYTES + 1), undefined, "too_large"],
      ["empty.pdf", new Uint8Array(0), undefined, "unreadable"],
      ["bad.xlsx", new Uint8Array([1]), { ok: false, reason: "corrupt" }, "unreadable"],
    ];
    for (const [name, bytes, parsed, code] of cases) {
      const { run, draft } = setup({ parsed });
      expect(await run(ask({ file: { name, bytes } })), name).toEqual({ ok: false, code });
      expect(draft).not.toHaveBeenCalled();
    }
  });

  test("C4112: a too_large answer from the drafter is too_large", async () => {
    const { run } = setup({ drafted: { ok: false, code: "too_large" } });
    expect(await run(ask({ file: { name: "a.pdf", bytes: new Uint8Array([1]) } }))).toEqual({ ok: false, code: "too_large" });
  });

  test("C4113: the file is not stored: the use case takes three dependencies (no storage), parses once and returns no file bytes", async () => {
    const bytes = new Uint8Array([9, 9, 9]);
    const { run, parse } = setup({ parsed: { ok: true, parsed: { format: "pdf", bytes } } });
    const result = await run(ask({ file: { name: "a.pdf", bytes } }));
    expect(makeDraftCatalog.length).toBe(3);
    expect(parse).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(result)).not.toContain("9,9,9");
  });

  test("C4101: a failing catalog read is unavailable", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { run, draft } = setup({ sizeError: true });
    expect(await run(ask())).toEqual({ ok: false, code: "unavailable" });
    expect(draft).not.toHaveBeenCalled();
  });
});

describe("acceptCatalogDraft", () => {
  const add = (answer: AddDraftResult = { ok: true, added: 2 }) => vi.fn<CatalogWriter["add"]>(async () => answer);

  test("C4115: the edited draft goes to the writer once with the org and trade, and the count comes back", async () => {
    const writer = add();
    const accept = makeAcceptCatalogDraft({ add: writer });
    const edited = [{ name: " Rodent stations ", months: [6, 3], tasks: ["Replace bait"] }, goodType];
    expect(await accept({ role: "admin", orgId: "org-1", trade: "pest control", types: edited })).toEqual({ ok: true, added: 2 });
    expect(writer).toHaveBeenCalledTimes(1);
    expect(writer).toHaveBeenCalledWith("org-1", "pest control", [{ name: "Rodent stations", months: [3, 6], tasks: ["Replace bait"] }, goodType]);
  });

  test("C4117: a bad draft or trade is invalid and the writer is not called", async () => {
    for (const types of [[], [{ ...goodType, months: [13] }], [goodType, { ...goodType, name: "TERMITE INSPECTION" }]]) {
      const writer = add();
      expect(await makeAcceptCatalogDraft({ add: writer })({ role: "owner", orgId: "o", trade: "pest control", types })).toEqual({ ok: false, code: "invalid" });
      expect(writer).not.toHaveBeenCalled();
    }
    const writer = add();
    expect(await makeAcceptCatalogDraft({ add: writer })({ role: "owner", orgId: "o", trade: "bad;trade", types: [goodType] })).toEqual({ ok: false, code: "invalid" });
  });

  test("C4119: an estimator, a viewer and a user with no membership are forbidden and the writer is not called", async () => {
    for (const role of ["estimator", "viewer", null] as const) {
      const writer = add();
      expect(await makeAcceptCatalogDraft({ add: writer })({ role, orgId: "o", trade: "pest control", types: [goodType] })).toEqual({ ok: false, code: "forbidden" });
      expect(writer).not.toHaveBeenCalled();
    }
  });

  test("C4118: the writer's not_empty answer comes back unchanged", async () => {
    const accept = makeAcceptCatalogDraft({ add: add({ ok: false, code: "not_empty" }) });
    expect(await accept({ role: "owner", orgId: "o", trade: "pest control", types: [goodType] })).toEqual({ ok: false, code: "not_empty" });
  });
});
