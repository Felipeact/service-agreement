import { describe, expect, test, vi } from "vitest";
import type { ContractSplitter, ImportParser, ParseResult, SplitResult } from "@/application/ports";
import type { Role } from "@/domain/members";
import { makeImportContractWording, MAX_CONTRACT_FILE_BYTES } from "./import-contract-wording";

const block = { type: "clause" as const, text: "Work is done by {{tenant.legalName}}." };

function setup(over: { parsed?: ParseResult; split?: SplitResult } = {}) {
  const split = vi.fn<ContractSplitter["split"]>(async () => over.split ?? { ok: true, blocks: [block] });
  const parse = vi.fn<ImportParser["parse"]>(async () => over.parsed ?? { ok: true, parsed: { format: "table", tables: [], text: "1. Work is done by Kettle Ridge." } });
  return { run: makeImportContractWording({ parse }, { split }), split, parse };
}

const file = (name: string, size = 10) => ({ name, bytes: new Uint8Array(size).fill(1) });
const ask = (over: Partial<Parameters<ReturnType<typeof setup>["run"]>[0]> = {}) => ({ role: "owner" as Role | null, file: file("contract.docx"), ...over });
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("importContractWording", () => {
  test("C5808: an owner or an admin with a docx calls the parser once and the splitter once with its text, and gets the form", async () => {
    for (const role of ["owner", "admin"] as const) {
      const { run, parse, split } = setup();
      const result = await run(ask({ role }));
      expect(result.ok && result.form.layout.map((row) => (row.kind === "block" ? row.text : row.key))).toEqual(["price", block.text, "signatures"]);
      expect(parse).toHaveBeenCalledTimes(1);
      expect(parse.mock.calls[0][0]).toBe(DOCX);
      expect(split).toHaveBeenCalledTimes(1);
      expect(split).toHaveBeenCalledWith({ file: { kind: "text", text: "1. Work is done by Kettle Ridge." } });
    }
  });

  test("C5808: a pdf is sent to the splitter as bytes", async () => {
    const bytes = new Uint8Array([9, 9]);
    const { run, split, parse } = setup({ parsed: { ok: true, parsed: { format: "pdf", bytes } } });
    expect((await run(ask({ file: file("Contract.PDF") }))).ok).toBe(true);
    expect(parse.mock.calls[0][0]).toBe("application/pdf");
    expect(split).toHaveBeenCalledWith({ file: { kind: "pdf", bytes } });
  });

  test("C5809: blocks that pass the bounds but make wording over the storage limit are unavailable", async () => {
    const big = Array.from({ length: 40 }, () => ({ type: "clause" as const, text: "a".repeat(2000) }));
    const { run } = setup({ split: { ok: true, blocks: big } });
    expect(await run(ask())).toEqual({ ok: false, code: "unavailable" });
  });

  test("C5810: the splitter's too_large and unavailable pass through, and a block the form cannot hold is unavailable", async () => {
    for (const code of ["too_large", "unavailable"] as const) {
      const { run } = setup({ split: { ok: false, code } });
      expect(await run(ask())).toEqual({ ok: false, code });
    }
    const { run } = setup({ split: { ok: true, blocks: [{ type: "clause", text: "Within {{terms.paymentDays}}." }] } });
    expect(await run(ask())).toEqual({ ok: false, code: "unavailable" });
  });

  test("C5811: the use case is built from a parser and a splitter and nothing that writes", () => {
    expect(makeImportContractWording.length).toBe(2);
  });

  test("C5813: an estimator, a viewer and no role are forbidden and nothing is called", async () => {
    for (const role of ["estimator", "viewer", null] as const) {
      const { run, parse, split } = setup();
      expect(await run(ask({ role })), String(role)).toEqual({ ok: false, code: "forbidden" });
      expect(parse).not.toHaveBeenCalled();
      expect(split).not.toHaveBeenCalled();
    }
  });

  test("C5814: no file and a zero-byte file are invalid and nothing is called", async () => {
    for (const given of [undefined, file("contract.docx", 0)]) {
      const { run, parse, split } = setup();
      expect(await run(ask({ file: given }))).toEqual({ ok: false, code: "invalid" });
      expect(parse).not.toHaveBeenCalled();
      expect(split).not.toHaveBeenCalled();
    }
  });

  test("C5815: xlsx, csv, doc and a name with no extension are unreadable, an unparseable file is unreadable, and the size edge is 4,194,304", async () => {
    for (const name of ["list.xlsx", "list.csv", "old.doc", "contract"]) {
      const { run, split } = setup();
      expect(await run(ask({ file: file(name) })), name).toEqual({ ok: false, code: "unreadable" });
      expect(split).not.toHaveBeenCalled();
    }
    const broken = setup({ parsed: { ok: false, reason: "unreadable" } as never });
    expect(await broken.run(ask())).toEqual({ ok: false, code: "unreadable" });
    expect(broken.split).not.toHaveBeenCalled();

    const over = setup();
    expect(await over.run(ask({ file: file("contract.pdf", MAX_CONTRACT_FILE_BYTES + 1) }))).toEqual({ ok: false, code: "too_large" });
    expect(over.parse).not.toHaveBeenCalled();
    expect(MAX_CONTRACT_FILE_BYTES).toBe(4_194_304);
    const edge = setup();
    expect((await edge.run(ask({ file: file("contract.pdf", MAX_CONTRACT_FILE_BYTES) }))).ok).toBe(true);
  });
});
