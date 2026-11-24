// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { afterEach, describe, expect, test } from "vitest";
import { bodyFromRichForm, EMPTY_RICH_FORM } from "@/domain/agreement/rich-form";
import { bodyFromContractRichForm } from "@/domain/contract/rich-form";
import { normalizeRichDoc, type RichDoc } from "@/domain/rich-document";
import { richExtensions } from "./extensions";
import { KeepSection } from "./keep-section";

const ORG = "11111111-1111-4111-8111-111111111111";
const ASSET = `${ORG}/22222222-2222-4222-8222-222222222222.png`;
let editors: Editor[] = [];

const make = (content: unknown, keep: string[] = []) => {
  const editor = new Editor({ extensions: [...richExtensions(""), KeepSection.configure({ keys: keep })], content: content as RichDoc });
  editors.push(editor);
  return editor;
};
const json = (editor: Editor) => editor.getJSON() as RichDoc;
const saveAgreement = (content: RichDoc) => bodyFromRichForm({ ...EMPTY_RICH_FORM, name: "Designed", content }, ORG);

afterEach(() => {
  editors.forEach((editor) => editor.destroy());
  editors = [];
});

describe("what the editor makes is what the server stores", () => {
  test("every tool's output passes the save rules: styles, colours, sizes, fonts, lists, a table, a picture, the logo, a field, sections, a page break", () => {
    const editor = make({ type: "doc", content: [{ type: "paragraph" }] });
    editor
      .chain()
      .insertContent("Hello ")
      .setMark("textStyle", { color: "#1d4ed8", fontSize: "18px", fontFamily: "serif" })
      .toggleBold()
      .insertContent("big blue words")
      .insertField("customer.name")
      .setHighlight({ color: "#fef08a" })
      .insertContent(" marked")
      .setTextAlign("center")
      .indentBy(1)
      .run();
    editor.chain().insertContentAt(editor.state.doc.content.size, [{ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Scope" }] }]).run();
    editor.chain().focus("end").insertSection("price").insertPageBreak().insertSection("schedule").run();
    editor.chain().focus("end").insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    editor.chain().setCellAttribute("background", "#eef2ff").run();
    editor.chain().focus("end").insertPicture(ASSET).insertCompanyLogo().setHorizontalRule().toggleBulletList().insertContent("one").run();
    editor.chain().focus("end").insertContent({ type: "paragraph", content: [{ type: "text", text: "site", marks: [{ type: "link", attrs: { href: "https://example.com" } }] }] }).run();

    const content = json(editor);
    const saved = saveAgreement(content);
    expect(saved.ok ? [] : saved.errors).toEqual([]);
    if (!saved.ok || saved.body.schema !== 3) throw new Error("not saved");
    const stored = JSON.stringify(saved.body.content);
    for (const part of ['"variable"', '"name":"customer.name"', '"key":"price"', '"key":"schedule"', '"pageBreak"', '"tableHeader"', '"background":"#eef2ff"', '"image"', '"companyLogo"', '"bulletList"', '"horizontalRule"', '"fontSize":"18px"', '"fontFamily":"serif"', '"color":"#1d4ed8"', '"textAlign":"center"', '"indent":1', '"href":"https://example.com"']) {
      expect(stored).toContain(part);
    }
    // Parts go where they were put, one after another; an insert never replaces the part just put down.
    expect(stored.indexOf('"key":"price"')).toBeLessThan(stored.indexOf('"pageBreak"'));
    expect(stored.indexOf('"pageBreak"')).toBeLessThan(stored.indexOf('"key":"schedule"'));
    expect(stored.indexOf('"image"')).toBeLessThan(stored.indexOf('"companyLogo"'));
    // The editor's own defaults (null colours, indent 0, colspan 1) are never stored.
    expect(stored).not.toContain("null");
    expect(stored).not.toContain('"colspan"');
  });

  test("text pasted from a word processor keeps what the page can draw and drops the rest, and still saves", () => {
    const editor = make(
      '<p><span style="color: rgb(220, 38, 38); font-size: 11pt; font-family: Calibri, sans-serif">Coloured</span> <b>Dear</b> <i>customer</i>, <u>thanks</u> {{customer.name}}</p>' +
        '<h4>A fourth-level heading</h4><blockquote>A quote</blockquote><pre><code>code</code></pre>' +
        '<img src="https://elsewhere.example/photo.png"><p><a href="http://plain.example">plain http</a> <a href="javascript:alert(1)">x</a></p>' +
        '<table><tr><th>Visit</th><th>Month</th></tr><tr><td>Spring</td><td>April</td></tr></table><ul><li>one</li><li>two</li></ul>',
    );
    const content = json(editor);
    const saved = saveAgreement(content);
    expect(saved.ok ? [] : saved.errors).toEqual([]);
    if (!saved.ok || saved.body.schema !== 3) throw new Error("not saved");
    const stored = JSON.stringify(saved.body.content);
    expect(stored).toContain('"color":"#dc2626"');
    expect(stored).toContain('"fontSize":"14px"');
    expect(stored).toContain('"fontFamily":"sans-serif"');
    // A typed field becomes a real field; a picture from elsewhere and a link that is not https do not survive.
    expect(stored).toContain('"type":"variable","attrs":{"name":"customer.name"}');
    expect(stored).not.toContain("elsewhere.example");
    expect(stored).not.toContain("javascript");
    expect(stored).not.toContain("http://plain");
    expect(stored).toContain("A quote");
  });

  test("a table cannot be put in a list or a cell, and a section cannot be put in a cell", () => {
    const editor = make({ type: "doc", content: [{ type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }] }] }] });
    editor.chain().focus("end").insertTable({ rows: 2, cols: 2 }).run();
    const saved = saveAgreement(json(editor));
    expect(saved.ok ? [] : saved.errors).toEqual([]);
    const table = make({ type: "doc", content: [{ type: "paragraph" }] });
    table.chain().insertTable({ rows: 2, cols: 2 }).run();
    // The cursor is in the first cell; a section goes after the table, on the page.
    table.chain().insertSection("terms").run();
    const top = json(table).content.map((node) => node.type);
    expect(top).toContain("section");
    expect(saveAgreement(json(table)).ok).toBe(true);
  });

  test("a merged cell is refused with a message that says to split it", () => {
    const editor = make({ type: "doc", content: [{ type: "paragraph" }] });
    editor.chain().insertTable({ rows: 2, cols: 2, withHeaderRow: false }).run();
    const cells: number[] = [];
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "tableCell") cells.push(pos);
    });
    editor.commands.setCellSelection({ anchorCell: cells[0], headCell: cells[1] });
    editor.commands.mergeCells();
    const saved = saveAgreement(json(editor));
    expect(saved.ok).toBe(false);
    if (!saved.ok) expect(Object.values(saved.errors).join(" ")).toMatch(/merged cells.*Split/);
  });
});

describe("a contract keeps its signatures", () => {
  const page = { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Terms" }] }, { type: "section", attrs: { key: "signatures", options: null } }] };

  test("deleting the signatures section, or replacing the page with one without it, is refused", () => {
    const editor = make(page, ["signatures"]);
    editor.commands.setNodeSelection(editor.state.doc.child(0).nodeSize);
    editor.commands.deleteSelection();
    editor.commands.setContent({ type: "doc", content: [{ type: "paragraph" }] });
    editor.commands.selectAll();
    editor.commands.deleteSelection();
    expect(json(editor).content.some((node) => node.type === "section" && node.attrs.key === "signatures")).toBe(true);
    expect(bodyFromContractRichForm({ doc: { title: "", showMeta: false, pageHeader: "first", pageFooter: "number" }, content: json(editor), header: null }).ok).toBe(true);
  });

  test("an agreement page may remove any section", () => {
    const editor = make(page);
    editor.commands.setNodeSelection(editor.state.doc.child(0).nodeSize);
    editor.commands.deleteSelection();
    expect(json(editor).content.some((node) => node.type === "section")).toBe(false);
  });

  test("the contract wording without signatures cannot be saved", () => {
    const content = normalizeRichDoc({ type: "doc", content: [{ type: "paragraph" }] }) as RichDoc;
    const saved = bodyFromContractRichForm({ doc: { title: "", showMeta: false, pageHeader: "first", pageFooter: "number" }, content, header: null });
    expect(saved.ok).toBe(false);
    if (!saved.ok) expect(Object.values(saved.errors)).toContain("The page needs the signatures.");
  });
});
