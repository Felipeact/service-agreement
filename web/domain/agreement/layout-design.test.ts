import { describe, expect, test } from "vitest";
import { accentOf, AGREEMENT_SECTION_KEYS, renderLayout, validateLayout, type LayoutItem, type LayoutSpec } from "./layout";
import { layoutFromRows, newTableRow, readLayoutFormState, rowsFromLayout } from "./layout-form";
import type { TemplateValues } from "../contract/template";

/** The design of a template (rich-template-editor slice 1): theme, block style and tables, in the layout's own rules and in the editor's rows. */

const SPEC: LayoutSpec = { sections: AGREEMENT_SECTION_KEYS, required: ["price"], noun: "agreement" };
const DOC = { title: "Agreement", showMeta: true, pageHeader: "first", pageFooter: "number" } as const;
const PRICE: LayoutItem = { kind: "section", key: "price" };
const table = (rows: unknown, header: unknown = true) => ({ kind: "table", header, rows });
const check = (layout: unknown[], doc: unknown = DOC) => validateLayout({ doc, layout }, SPEC).map((error) => error.field);

describe("validating a designed layout", () => {
  test("a theme, a styled paragraph and a table are accepted", () => {
    const layout = [{ kind: "block", type: "paragraph", text: "Hello", style: { align: "center", bold: true } }, table([["A", "B"], ["{{customer.name}}", ""]]), PRICE];
    expect(check(layout, { ...DOC, theme: { accent: "teal", font: "serif" } })).toEqual([]);
  });

  test("an unknown accent, font, theme key or style option is named", () => {
    expect(check([PRICE], { ...DOC, theme: { accent: "pink" } })).toEqual(["doc.theme.accent"]);
    expect(check([PRICE], { ...DOC, theme: { font: "comic" } })).toEqual(["doc.theme.font"]);
    expect(check([PRICE], { ...DOC, theme: { size: 9 } })).toEqual(["doc.theme"]);
    expect(check([{ kind: "block", type: "paragraph", text: "x", style: { align: "justify" } }, PRICE])).toEqual(["layout.0.style.align"]);
    expect(check([{ kind: "block", type: "paragraph", text: "x", style: { underline: true } }, PRICE])).toEqual(["layout.0.style"]);
  });

  test("a table is held to its size, its shape and the variable whitelist", () => {
    expect(check([table([]), PRICE])).toEqual(["layout.0.rows"]);
    expect(check([table(Array.from({ length: 13 }, () => ["a"])), PRICE])).toEqual(["layout.0.rows"]);
    expect(check([table([["a", "b", "c", "d", "e", "f"]]), PRICE])).toEqual(["layout.0.rows"]);
    expect(check([table([["a", "b"], ["c"]]), PRICE])).toEqual(["layout.0.rows.1"]);
    expect(check([table([["a", "b"]], "yes"), PRICE])).toEqual(["layout.0.header"]);
    expect(check([table([["{{nope}}", "b"]]), PRICE])).toEqual(["layout.0.rows.0.0"]);
    expect(check([table([["x".repeat(121)]]), PRICE])).toEqual(["layout.0.rows.0.0"]);
  });
});

describe("filling and reading a designed layout", () => {
  test("a table's cells are filled with the document's values, and the style travels with the block", () => {
    const values = { "customer.name": "Fernwood Dental" } as TemplateValues;
    const [filled] = renderLayout([table([["Customer", "{{customer.name}}"]]) as LayoutItem, PRICE], values);
    expect(filled).toMatchObject({ kind: "table", rows: [["Customer", "Fernwood Dental"]] });
    const [block] = renderLayout([{ kind: "block", type: "paragraph", text: "Hi", style: { italic: true } }, PRICE], values);
    expect(block).toMatchObject({ style: { italic: true } });
  });

  test("the template's accent wins over the company's, and without one the company's stands", () => {
    expect(accentOf({ theme: { accent: "rose" } }, "#1f6f8b")).toBe("#be123c");
    expect(accentOf({}, "#1f6f8b")).toBe("#1f6f8b");
  });

  test("the editor's rows keep a table and a style across a save, and drop a style that is the plain look", () => {
    const layout: LayoutItem[] = [
      { kind: "block", type: "heading", text: "Welcome", style: { align: "center", bold: true } },
      { kind: "table", header: false, rows: [["a", "b"]] },
      PRICE,
    ];
    expect(layoutFromRows(rowsFromLayout(layout))).toEqual(layout);
    const plain = rowsFromLayout([{ kind: "block", type: "paragraph", text: "x", style: { align: "left", bold: false } }]);
    expect(layoutFromRows(plain)).toEqual([{ kind: "block", type: "paragraph", text: "x" }]);
    expect(layoutFromRows([newTableRow()])).toEqual([{ kind: "table", header: true, rows: [["", ""], ["", ""]] }]);
  });

  test("a posted form with a table, a style and a theme is read back whole; a bad style is refused with its field", () => {
    const post = (layout: unknown[]) => readLayoutFormState({ doc: { ...DOC, theme: { accent: "blue" } }, layout });
    const ok = post([{ kind: "table", header: true, rows: [["a", "b"]] }, { kind: "block", type: "paragraph", text: "x", level: 2, indent: 0, pageBreakBefore: false, style: { bold: true } }]);
    expect(ok.ok && ok.state.doc.theme).toEqual({ accent: "blue" });
    expect(ok.ok && ok.state.layout.map((row) => row.kind)).toEqual(["table", "block"]);
    const bad = post([{ kind: "block", type: "paragraph", text: "x", level: 2, indent: 0, pageBreakBefore: false, style: { align: "wide" } }]);
    expect(!bad.ok && bad.errors[0].field).toBe("layout.0.style.align");
  });
});
