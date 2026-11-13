import { describe, expect, test } from "vitest";
import { bodyFromContractForm, contractFormFromBody, readContractFormInput } from "./layout-form";
import { contractLayoutOf } from "./layout";
import { SYSTEM_CONTRACT_BODY } from "./template";

describe("contract wording opened in the block editor", () => {
  test("C5552: the system wording opens as the rows of contractLayoutOf, with the signatures title as a heading row", () => {
    const form = contractFormFromBody(SYSTEM_CONTRACT_BODY);
    expect(form.doc.title).toBe("Service Contract");
    const keys = form.layout.map((row) => (row.kind === "section" ? row.key : row.type));
    expect(keys.slice(0, 4)).toEqual(["price", "schedule", "included", "equipment"]);
    expect(keys.at(-1)).toBe("signatures");
    expect(form.layout.at(-2)).toMatchObject({ kind: "block", type: "heading", text: "Signatures" });
  });

  test("C5552: saving the system wording unedited writes schema 2 wording the validator accepts, with the same blocks in the same order", () => {
    const saved = bodyFromContractForm(contractFormFromBody(SYSTEM_CONTRACT_BODY));
    expect(saved.ok).toBe(true);
    if (!saved.ok || saved.body.schema !== 2) throw new Error("expected schema 2 wording");
    const legacy = contractLayoutOf(SYSTEM_CONTRACT_BODY).layout.filter((item) => item.kind === "block");
    expect(saved.body.layout.filter((item) => item.kind === "block").slice(0, legacy.length)).toEqual(legacy);
  });

  test("C5554: a missing signatures section, an empty text and an unknown variable are refused on their rows", () => {
    const form = contractFormFromBody(SYSTEM_CONTRACT_BODY);
    const noSignatures = bodyFromContractForm({ ...form, layout: form.layout.filter((row) => !(row.kind === "section" && row.key === "signatures")) });
    expect(noSignatures.ok).toBe(false);
    if (!noSignatures.ok) expect(noSignatures.errors.layout).toContain("signatures");
    const blocks = form.layout.flatMap((row, at) => (row.kind === "block" ? [at] : []));
    const typed = form.layout.map((row, at) => (at === blocks[0] && row.kind === "block" ? { ...row, text: "  " } : at === blocks[1] && row.kind === "block" ? { ...row, text: "{{nope}}" } : row));
    const result = bodyFromContractForm({ ...form, layout: typed });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[`layout.${blocks[0]}.text`]).toContain("empty");
      expect(result.errors[`layout.${blocks[1]}.text`]).toContain("unknown variable");
    }
  });

  test("C5555: a posted contract form is read, and a malformed one is one error", () => {
    expect(readContractFormInput(JSON.parse(JSON.stringify(contractFormFromBody(SYSTEM_CONTRACT_BODY)))).ok).toBe(true);
    expect(readContractFormInput(null)).toMatchObject({ ok: false });
    expect(readContractFormInput({ doc: null, layout: [] })).toEqual({ ok: false, errors: [{ field: "doc", message: "The document options must be an object." }] });
  });
});
