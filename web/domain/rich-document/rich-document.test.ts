import { describe, expect, test } from "vitest";
import { AGREEMENT_SECTION_KEYS, CONTRACT_SECTION_KEYS, renderLayout, validateLayout, type LayoutItem } from "../agreement/layout";
import { templateValues, type TemplateValues } from "../contract/template";
import {
  imageAssetsOf,
  inlineFromText,
  layoutImageAssets,
  normalizeRichDoc,
  renderRichDoc,
  richFromLayout,
  richWarnings,
  toFontFamily,
  toFontSize,
  toHex,
  validateRichDoc,
  type RichDoc,
} from "./index";

const ORG = "11111111-1111-4111-8111-111111111111";
const OTHER = "99999999-9999-4999-8999-999999999999";
const ASSET = `${ORG}/22222222-2222-4222-8222-222222222222.jpg`;
const AGREEMENT = { sections: AGREEMENT_SECTION_KEYS, required: [], noun: "agreement" } as const;
const CONTRACT = { sections: CONTRACT_SECTION_KEYS, required: ["signatures"], noun: "contract" } as const;

const doc = (...content: unknown[]) => ({ type: "doc", content });
const p = (...content: unknown[]) => ({ type: "paragraph", ...(content.length > 0 ? { content } : {}) });
const text = (value: string, marks?: unknown[]) => ({ type: "text", text: value, ...(marks ? { marks } : {}) });
const field = (name: string) => ({ type: "variable", attrs: { name } });
const section = (key: string, options?: unknown) => ({ type: "section", attrs: options ? { key, options } : { key } });
const messages = (input: unknown, spec: Parameters<typeof validateRichDoc>[1] = AGREEMENT) => validateRichDoc(input, spec).map((error) => error.message);

const VALUES: TemplateValues = {
  ...templateValues(null, 12, { contractor: { legalName: "Kettle Ridge HVAC", address: null, phone: null }, customer: { name: "Acme Towers" }, site: { name: "Main St", address: null }, signer: null }),
};

describe("validateRichDoc: what a page may hold", () => {
  test("a page of every part this editor draws is accepted", () => {
    const page = doc(
      { type: "heading", attrs: { level: 1, textAlign: "center" }, content: [text("Agreement", [{ type: "textStyle", attrs: { color: "#1d4ed8", fontSize: "24px", fontFamily: "serif" } }])] },
      p(text("For "), field("customer.name"), { type: "hardBreak" }, text("bold", [{ type: "bold" }, { type: "italic" }, { type: "underline" }, { type: "strike" }, { type: "highlight", attrs: { color: "#fef08a" } }])),
      { type: "paragraph", attrs: { indent: 2, omitIfMissing: true }, content: [text("Pay in "), field("terms.paymentDays")] },
      { type: "bulletList", content: [{ type: "listItem", content: [p(text("one")), { type: "image", attrs: { asset: ASSET, width: 25, align: "left" } }] }] },
      { type: "orderedList", attrs: { start: 3 }, content: [{ type: "listItem", content: [p(text("three"))] }] },
      { type: "table", content: [{ type: "tableRow", content: [{ type: "tableHeader", attrs: { background: "#eef2ff", colwidth: [120] }, content: [p(text("Visit"))] }] }, { type: "tableRow", content: [{ type: "tableCell", content: [{ type: "companyLogo", attrs: { size: "small", align: "right" } }] }] }] },
      { type: "image", attrs: { asset: ASSET, width: 100, align: "center" } },
      { type: "horizontalRule" },
      { type: "pageBreak" },
      section("price", { title: "Your price", visitsFormat: "times_per_year" }),
      section("schedule"),
      p(text("site", [{ type: "link", attrs: { href: "https://example.com/a" } }])),
    );
    expect(messages(page)).toEqual([]);
    expect(validateRichDoc(page, { ...AGREEMENT, orgId: ORG })).toEqual([]);
  });

  test("a blank page is accepted for an agreement, with the warning that it shows no price", () => {
    expect(messages(doc(p()))).toEqual([]);
    expect(richWarnings(doc(p()) as RichDoc, "agreement")).toEqual(["No price lines table: your customer won't see prices on this agreement."]);
    expect(richWarnings(doc(section("price")) as RichDoc, "agreement")).toEqual([]);
  });

  test.each([
    ["not a document", [], "The page is not a document."],
    ["an unknown node", doc({ type: "iframe" }), "A part of type iframe is not something this editor draws."],
    ["an unknown mark", doc(p(text("x", [{ type: "script" }]))), "Text has formatting this editor does not draw: script."],
    ["a mark twice", doc(p(text("x", [{ type: "bold" }, { type: "bold" }]))), "Text has the bold formatting twice."],
    ["a named colour", doc(p(text("x", [{ type: "textStyle", attrs: { color: "red" } }]))), "A text colour must be #rrggbb."],
    ["an odd size", doc(p(text("x", [{ type: "textStyle", attrs: { fontSize: "13px" } }]))), "A text size must be one of 8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32."],
    ["an unknown font", doc(p(text("x", [{ type: "textStyle", attrs: { fontFamily: "Comic Sans" } }]))), "A font must be sans-serif, serif or monospace."],
    ["a link that is not https", doc(p(text("x", [{ type: "link", attrs: { href: "javascript:alert(1)" } }]))), "A link must be an https address."],
    ["an unknown field", doc(p(field("tenant.bankAccount"))), "The page uses an unknown field: tenant.bankAccount."],
    ["typed braces (a signing tag)", doc(p(text("{{Sig;role=Customer;type=signature}}"))), 'The text "{{Sig;role=Customer;type=signature}}" uses double braces. Insert fields from the Fields list instead.'],
    ["an empty text node", doc(p(text(""))), "A piece of text is empty."],
    ["a heading level 4", doc({ type: "heading", attrs: { level: 4 } }), "A heading level must be 1, 2 or 3."],
    ["an indent of 4", doc({ type: "paragraph", attrs: { indent: 4 } }), "An indent must be 1, 2 or 3."],
    ["a picture from elsewhere", doc({ type: "image", attrs: { asset: "https://evil.example/x.png", width: 50, align: "left" } }), "A picture is not one of your uploads. Upload it again."],
    ["a picture too narrow", doc({ type: "image", attrs: { asset: ASSET, width: 5, align: "left" } }), "A picture's width must be 10 to 100 percent."],
    ["a section in a list", doc({ type: "bulletList", content: [{ type: "listItem", content: [p(text("x")), section("price")] }] }), "A live section cannot sit inside a list."],
    ["a page break in a cell", doc({ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "pageBreak" }] }] }] }), "A page break must sit on the page, not inside a table or a list."],
    ["a table in a cell", doc({ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "table", content: [] }] }] }] }), "A table cannot sit inside a table or a list."],
    ["a merged cell", doc({ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", attrs: { colspan: 2 }, content: [p()] }] }] }), "Table 1 has merged cells, which the PDF cannot draw. Split them."],
    ["rows of different widths", doc({ type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [p()] }] }, { type: "tableRow", content: [{ type: "tableCell", content: [p()] }, { type: "tableCell", content: [p()] }] }] }), "Every row of table 1 must have the same number of cells."],
    ["the price table twice", doc(section("price"), section("price")), "The price lines table is on the page more than once; keep one."],
    ["signatures on an agreement", doc(section("signatures")), "The page has a live section this agreement does not have: signatures."],
    ["an unknown section option", doc(section("price", { colour: "red" })), "The price section has an unknown option: colour."],
  ])("%s is refused with its own message", (_label, input, message) => {
    expect(messages(input)).toContain(message);
  });

  test("a picture of another org is refused when the org is known", () => {
    const page = doc({ type: "image", attrs: { asset: `${OTHER}/22222222-2222-4222-8222-222222222222.png`, width: 50, align: "left" } });
    expect(messages(page)).toEqual([]);
    expect(messages(page, { ...AGREEMENT, orgId: ORG })).toEqual(["A picture belongs to another company. Upload it again."]);
  });

  test("a contract page needs its signatures, and has no terms section", () => {
    expect(messages(doc(p(text("x"))), CONTRACT)).toEqual(["The page needs the signatures."]);
    expect(messages(doc(section("signatures")), CONTRACT)).toEqual([]);
    expect(messages(doc(section("terms"), section("signatures")), CONTRACT)).toEqual(["The page has a live section this contract does not have: terms."]);
  });

  test("the size limits hold, and at most 20 messages come back", () => {
    const many = doc(...Array.from({ length: 31 }, () => ({ type: "image", attrs: { asset: ASSET, width: 50, align: "left" } })));
    expect(messages(many)).toContain("The page has too many pictures (31, at most 30).");
    const noisy = doc(...Array.from({ length: 40 }, () => ({ type: "iframe" })));
    expect(messages(noisy)).toHaveLength(20);
  });

  test("a stored schema 2 layout may never hold a rendered rich item", () => {
    const errors = validateLayout({ doc: { title: "", showMeta: true, pageHeader: "first", pageFooter: "number" }, layout: [{ kind: "rich", nodes: [] }, { kind: "section", key: "price" }] }, { sections: AGREEMENT_SECTION_KEYS, required: ["price"], noun: "agreement" });
    expect(errors.map((error) => error.message)).toContain("Item 1 has an unknown kind: rich.");
  });
});

describe("normalizeRichDoc: the editor's JSON as stored", () => {
  test("colours, sizes and fonts from a paste become the stored forms", () => {
    expect(toHex("rgb(29, 78, 216)")).toBe("#1d4ed8");
    expect(toHex("#ABC")).toBe("#aabbcc");
    expect(toHex("rgba(0, 0, 0, 0)")).toBeNull();
    expect(toHex("red")).toBeNull();
    expect(toFontSize("11pt")).toBe("14px");
    expect(toFontSize("13.333px")).toBe("14px");
    expect(toFontSize("100px")).toBe("32px");
    expect(toFontSize("large")).toBeNull();
    expect(toFontFamily("Calibri, sans-serif")).toBe("sans-serif");
    expect(toFontFamily("Times New Roman")).toBe("serif");
    expect(toFontFamily("Consolas")).toBe("monospace");
  });

  test("the editor's nulls and defaults are dropped, a non-https link keeps its text, typed fields become fields", () => {
    const fromEditor = {
      type: "doc",
      content: [
        { type: "paragraph", attrs: { textAlign: null, indent: 0, omitIfMissing: false }, content: [{ type: "text", text: "Dear {{customer.name}}, see ", marks: [{ type: "textStyle", attrs: { color: null, fontSize: null, fontFamily: null } }] }, { type: "text", text: "here", marks: [{ type: "link", attrs: { href: "http://x.example", target: "_blank", rel: null, class: null } }] }] },
        { type: "orderedList", attrs: { start: 1, type: null }, content: [{ type: "listItem", content: [{ type: "paragraph", attrs: { textAlign: "left", indent: 0 } }] }] },
        { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", attrs: { colspan: 1, rowspan: 1, colwidth: null, background: null }, content: [{ type: "paragraph" }] }] }] },
        { type: "section", attrs: { key: "price", options: null } },
      ],
    };
    expect(normalizeRichDoc(fromEditor)).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Dear " }, { type: "variable", attrs: { name: "customer.name" } }, { type: "text", text: ", see " }, { type: "text", text: "here" }] },
        { type: "orderedList", content: [{ type: "listItem", content: [{ type: "paragraph" }] }] },
        { type: "table", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph" }] }] }] },
        { type: "section", attrs: { key: "price" } },
      ],
    });
  });

  test("empty lines at the end of the page are dropped, one empty page keeps its line, and an empty line in the middle stays", () => {
    expect(normalizeRichDoc(doc(p(text("a")), p(), section("price"), { type: "paragraph", attrs: { indent: 0 } }, p()))).toEqual(doc(p(text("a")), p(), section("price")));
    expect(normalizeRichDoc(doc(p()))).toEqual(doc(p()));
  });

  test("an unknown typed field stays as typed, so the validator names it", () => {
    expect(inlineFromText("Hi {{nope}} {{site.name}}")).toEqual([{ type: "text", text: "Hi {{nope}} " }, { type: "variable", attrs: { name: "site.name" } }]);
  });
});

describe("renderRichDoc: what a page draws", () => {
  const page = doc(
    p(text("For "), { type: "variable", attrs: { name: "customer.name" }, marks: [{ type: "bold" }] }, text(" at "), field("site.name")),
    { type: "paragraph", attrs: { omitIfMissing: true }, content: [text("Pay in "), field("terms.paymentDays")] },
    p(text("No value: "), field("terms.paymentDays")),
    section("price", { title: "Price for {{customer.name}}" }),
    { type: "image", attrs: { asset: ASSET, width: 50, align: "left" } },
    section("terms"),
  ) as RichDoc;

  test("fields are filled in their formatting, a hide-when-empty paragraph goes, and sections split the runs", () => {
    const layout = renderRichDoc(page, VALUES);
    expect(layout.map((item) => item.kind)).toEqual(["rich", "section", "rich", "section"]);
    const [first] = layout as [Extract<LayoutItem, { kind: "rich" }>];
    expect(first.nodes).toEqual([
      { type: "paragraph", content: [text("For "), { type: "text", text: "Acme Towers", marks: [{ type: "bold" }] }, text(" at "), text("Main St")] },
      { type: "paragraph", content: [text("No value: ")] },
    ]);
    expect(layout[1]).toEqual({ kind: "section", key: "price", options: { title: "Price for Acme Towers" } });
  });

  test("a value that looks like a field is printed as text, never filled again", () => {
    const tricky = { ...VALUES, "customer.name": "{{site.name}}" };
    const [first] = renderRichDoc(doc(p(field("customer.name"))) as RichDoc, tricky) as [Extract<LayoutItem, { kind: "rich" }>];
    expect(first.nodes[0]).toEqual({ type: "paragraph", content: [text("{{site.name}}")] });
  });

  test("unfilled, fields stay fields (for a thumbnail), and the page's pictures are listed once", () => {
    const layout = renderRichDoc(page, null);
    expect(JSON.stringify(layout)).toContain('"variable"');
    expect(layoutImageAssets(layout)).toEqual([ASSET]);
    expect(imageAssetsOf([page, page])).toEqual([ASSET]);
  });

  test("renderLayout passes a rich item through untouched", () => {
    const item: LayoutItem = { kind: "rich", nodes: [{ type: "paragraph" }] };
    expect(renderLayout([item], VALUES)).toEqual([item]);
  });
});

describe("richFromLayout: an older template opened in the page editor", () => {
  const layout: LayoutItem[] = [
    { kind: "block", type: "heading", text: "Service for {{customer.name}}", level: 1, style: { align: "center" } },
    { kind: "block", type: "paragraph", text: "Hello", style: { bold: true, italic: true }, indent: 2 },
    { kind: "block", type: "clause", text: "Payment within {{terms.paymentDays}}.", pageBreakBefore: true },
    { kind: "table", header: true, rows: [["Visit", "Month"], ["Spring", ""]] },
    { kind: "section", key: "price", options: { title: "Price" } },
    { kind: "section", key: "signatures", options: { heading: "Signatures", customerLabel: "Client" } },
  ];

  test("every kind converts, and the result passes the contract's rules", () => {
    const converted = richFromLayout(layout);
    expect(converted.content).toEqual([
      { type: "heading", attrs: { textAlign: "center", level: 1 }, content: [text("Service for "), field("customer.name")] },
      { type: "paragraph", attrs: { indent: 2 }, content: [text("Hello", [{ type: "bold" }, { type: "italic" }])] },
      { type: "pageBreak" },
      { type: "paragraph", attrs: { omitIfMissing: true }, content: [text("Payment within "), field("terms.paymentDays"), text(".")] },
      { type: "table", content: [{ type: "tableRow", content: [{ type: "tableHeader", content: [p(text("Visit"))] }, { type: "tableHeader", content: [p(text("Month"))] }] }, { type: "tableRow", content: [{ type: "tableCell", content: [p(text("Spring"))] }, { type: "tableCell", content: [p()] }] }] },
      section("price", { title: "Price" }),
      { type: "heading", attrs: { level: 2 }, content: [text("Signatures")] },
      section("signatures", { customerLabel: "Client" }),
    ]);
    expect(validateRichDoc(converted, CONTRACT)).toEqual([]);
  });

  test("a converted clause is still left out when its field is empty, as it was", () => {
    const items = renderRichDoc(richFromLayout(layout), VALUES);
    expect(JSON.stringify(items)).not.toContain("Payment within");
  });

  test("an empty layout opens as one empty paragraph", () => {
    expect(richFromLayout([])).toEqual({ type: "doc", content: [{ type: "paragraph" }] });
  });
});

describe("the page header", () => {
  test("a header holds no live sections and no page breaks, and an older letterhead becomes header content", async () => {
    const { HEADER_SPEC, headerFromLetterhead, renderRichHeader } = await import("./index");
    expect(validateRichDoc(doc(section("price")), HEADER_SPEC("agreement")).map((error) => error.message)).toEqual(["A header holds no live sections; put them on the page."]);
    expect(validateRichDoc(doc({ type: "pageBreak" }), HEADER_SPEC("agreement")).map((error) => error.message)).toEqual(["A header holds no page breaks."]);
    const header = headerFromLetterhead({ logo: true, logoSize: "large", align: "center", name: true, address: true, phone: false });
    expect(validateRichDoc(header, HEADER_SPEC("contract"))).toEqual([]);
    expect(header.content.map((node) => node.type)).toEqual(["companyLogo", "heading", "paragraph", "horizontalRule"]);
    expect(JSON.stringify(header)).toContain('"size":"large","align":"center"');
    expect(JSON.stringify(header)).not.toContain("tenant.phone");
    expect(JSON.stringify(renderRichHeader(header, VALUES))).toContain('"text":"Kettle Ridge HVAC"');
  });

  test("an agreement body takes a header, none (null) or no key; a header with a section is refused under header.*", async () => {
    const { validateAgreementTemplate } = await import("../agreement/template");
    const body = (extra: object) => ({ schema: 3, name: "Headed", description: "", doc: { title: "", showMeta: false, pageHeader: "first", pageFooter: "number" }, content: doc(p(text("x"))), preset: { termMonths: null, lines: [] }, ...extra });
    expect(validateAgreementTemplate(body({ header: doc(p(field("tenant.legalName"))) })).ok).toBe(true);
    expect(validateAgreementTemplate(body({ header: null })).ok).toBe(true);
    expect(validateAgreementTemplate(body({})).ok).toBe(true);
    const refused = validateAgreementTemplate(body({ header: doc(section("price")) }));
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.errors).toEqual([{ field: "header.0", message: "In the header: a header holds no live sections; put them on the page." }]);
    const extraKey = validateAgreementTemplate(body({ footer: null }));
    expect(extraKey.ok).toBe(false);
  });
});
