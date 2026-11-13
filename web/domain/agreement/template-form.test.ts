import { describe, expect, test } from "vitest";
import { copyName, SYSTEM_AGREEMENT_BODY } from "./template";
import { layoutOf } from "./layout";
import {
  bodyFromLayoutForm,
  bodyFromTemplateForm,
  EMPTY_LAYOUT_FORM,
  EMPTY_TEMPLATE_FORM,
  layoutFormFromBody,
  previewBodyFromLayoutForm,
  readLayoutFormInput,
  templateFormFromBody,
} from "./template-form";

const LINE = { description: "Quarterly HVAC visit", visitMonths: [9, 3, 6, 12], assetTypeCodes: ["RTU"], costPerVisit: "$450.00" };

describe("the editor's fields to a body", () => {
  test("C5350: a valid form becomes a schema 1 body with sorted months, cents and the text split into blocks", () => {
    const result = bodyFromTemplateForm({ ...EMPTY_TEMPLATE_FORM, name: " Quarterly ", intro: "# Welcome\nHello.\n- Pay on time.", termMonths: "24", lines: [LINE] });
    expect(result).toEqual({
      ok: true,
      body: {
        schema: 1,
        name: "Quarterly",
        description: "",
        intro: [{ type: "heading", text: "Welcome" }, { type: "paragraph", text: "Hello." }, { type: "clause", text: "Pay on time." }],
        footer: [],
        sections: { schedule: true, scope: true },
        preset: { termMonths: 24, lines: [{ description: "Quarterly HVAC visit", visitMonths: [3, 6, 9, 12], assetTypeCodes: ["RTU"], costPerVisitCents: 45000 }] },
      },
    });
  });

  test("C5350: each bad field is named under the key the editor shows it beside", () => {
    const result = bodyFromTemplateForm({ ...EMPTY_TEMPLATE_FORM, name: "", termMonths: "abc", lines: [{ ...LINE, costPerVisit: "lots" }, { ...LINE, visitMonths: [] }] });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(Object.keys(result.errors).sort()).toEqual(["name", "preset.lines.0.costPerVisitCents", "preset.lines.1.visitMonths", "preset.termMonths"]);
  });

  test("C5350: an empty price and an empty term are null, and a term over 60 is refused", () => {
    const ok = bodyFromTemplateForm({ ...EMPTY_TEMPLATE_FORM, name: "A", lines: [{ ...LINE, costPerVisit: "" }] });
    expect(ok).toMatchObject({ ok: true, body: { preset: { termMonths: null, lines: [{ costPerVisitCents: null }] } } });
    expect(bodyFromTemplateForm({ ...EMPTY_TEMPLATE_FORM, name: "A", termMonths: "61" })).toMatchObject({ ok: false, errors: { "preset.termMonths": expect.any(String) } });
  });

  test("C5349: a stored body fills the editor and comes back as the same body", () => {
    const form = { ...EMPTY_TEMPLATE_FORM, name: "Q", description: "d", intro: "# H\n- c", footer: "Bye.", scope: false, termMonths: "12", lines: [{ ...LINE, visitMonths: [3, 6, 9, 12] }] };
    const body = bodyFromTemplateForm(form);
    if (!body.ok) throw new Error("unreachable");
    expect(templateFormFromBody(body.body)).toEqual(form);
  });
});

describe("the name of a duplicate", () => {
  test.each([
    ["Quarterly", [], "Quarterly (copy)"],
    ["Quarterly", ["Quarterly (copy)"], "Quarterly (copy 2)"],
    ["Quarterly", ["quarterly (COPY)", "Quarterly (copy 2)"], "Quarterly (copy 3)"],
  ])("C5352: %s with %j taken is %s", (name, taken, expected) => {
    expect(copyName(name, taken)).toBe(expected);
  });

  test("C5352: a name at the 80-character limit is cut so the copy fits", () => {
    expect(copyName("x".repeat(80), []).length).toBe(80);
    expect(copyName("x".repeat(80), []).endsWith(" (copy)")).toBe(true);
  });
});

describe("a saved body opened in the editor", () => {
  test("C5422: the editor's values for a stored body give back exactly that body, with its intro, closing text, both switches and two preset lines", () => {
    const body = {
      ...SYSTEM_AGREEMENT_BODY,
      name: "Quarterly HVAC",
      description: "Four visits a year.",
      intro: [{ type: "heading" as const, text: "About this agreement" }, { type: "paragraph" as const, text: "Welcome {{customer.name}}." }, { type: "clause" as const, text: "Pay in {{terms.paymentDays}} days." }],
      footer: [{ type: "paragraph" as const, text: "Thank you." }],
      sections: { schedule: false, scope: true },
      preset: {
        termMonths: 24,
        lines: [
          { description: "Quarterly visit", visitMonths: [3, 6, 9, 12], assetTypeCodes: ["RTU", "HP"], costPerVisitCents: 45000 },
          { description: "Annual inspection", visitMonths: [6], assetTypeCodes: [], costPerVisitCents: null },
        ],
      },
    };
    const reopened = bodyFromTemplateForm(templateFormFromBody(body));
    expect(reopened).toEqual({ ok: true, body });
  });

  test("C5422: both switches on, no term and no lines also come back unchanged", () => {
    const body = { ...SYSTEM_AGREEMENT_BODY, name: "Plain" };
    expect(bodyFromTemplateForm(templateFormFromBody(body))).toEqual({ ok: true, body });
  });
});

describe("a schema 1 template opened in the block editor", () => {
  const V1 = {
    ...SYSTEM_AGREEMENT_BODY,
    name: "Quarterly HVAC",
    description: "Four visits a year.",
    intro: [{ type: "heading" as const, text: "About this agreement" }, { type: "paragraph" as const, text: "Welcome {{customer.name}}." }],
    footer: [{ type: "clause" as const, text: "Thank you." }],
    sections: { schedule: false, scope: true },
    preset: { termMonths: 24, lines: [{ description: "Quarterly visit", visitMonths: [3, 6, 9, 12], assetTypeCodes: ["RTU"], costPerVisitCents: 45000 }] },
  };

  test("C5547: it opens as its layoutOf rows and document options", () => {
    const form = layoutFormFromBody(V1);
    expect(form.doc).toEqual({ title: "Preventive maintenance service agreement", showMeta: true, pageHeader: "first", pageFooter: "number" });
    expect(form.layout.map((row) => (row.kind === "block" ? `${row.type}:${row.text}` : row.key))).toEqual([
      "heading:About this agreement",
      "paragraph:Welcome {{customer.name}}.",
      "price",
      "included",
      "equipment",
      "terms",
      "clause:Thank you.",
    ]);
    expect(form.name).toBe("Quarterly HVAC");
    expect(form.termMonths).toBe("24");
    expect(form.lines[0].costPerVisit).toBe("$450.00");
  });

  test("C5547: saving it posts a schema 2 body whose layout equals the rows it opened with, and the preset is unchanged", () => {
    const saved = bodyFromLayoutForm(layoutFormFromBody(V1));
    expect(saved.ok).toBe(true);
    if (!saved.ok || saved.body.schema !== 2) throw new Error("expected a schema 2 body");
    expect(saved.body.layout).toEqual(layoutOf(V1).layout);
    expect(saved.body.doc).toEqual(layoutOf(V1).doc);
    expect(saved.body.preset).toEqual(V1.preset);
    expect(saved.body.name).toBe("Quarterly HVAC");
  });

  test("C5547: a schema 2 body with options opens and saves back as the same body", () => {
    const body = {
      schema: 2 as const,
      name: "Proposal",
      description: "",
      doc: { title: "Maintenance schedule for {{site.name}}", showMeta: false, pageHeader: "every" as const, pageFooter: "letterhead" as const },
      layout: [
        { kind: "block" as const, type: "heading" as const, text: "Schedule", level: 1 as const },
        { kind: "block" as const, type: "clause" as const, text: "Filters.", indent: 2 as const, pageBreakBefore: true },
        { kind: "section" as const, key: "included" as const, options: { title: "Service included:", showFrequency: true, uppercase: true } },
        {
          kind: "section" as const,
          key: "price" as const,
          options: { title: "CHARGE", columns: { description: "A", visits: "B", perVisit: "C", perYear: "D", total: "E" }, visitsFormat: "times_per_year" as const },
        },
        { kind: "section" as const, key: "equipment" as const, options: { title: "EQUIPMENT LIST" } },
      ],
      preset: { termMonths: null, lines: [] },
    };
    expect(bodyFromLayoutForm(layoutFormFromBody(body))).toEqual({ ok: true, body });
  });

  test("C5548: a row's message is keyed layout.<row> so the editor shows it beside that row, and the typed rows are untouched", () => {
    const form = layoutFormFromBody(V1);
    const row = form.layout[1];
    if (row.kind !== "block") throw new Error("expected a block row");
    form.layout[1] = { ...row, text: "Hello {{nope}}." };
    const result = bodyFromLayoutForm(form);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors["layout.1.text"]).toContain("unknown variable");
    expect(form.layout[1]).toMatchObject({ text: "Hello {{nope}}." });
  });

  test("C5547: a half-typed column set is flagged on its row, and an untouched option is not stored", () => {
    const form = layoutFormFromBody(V1);
    const price = form.layout.findIndex((row) => row.kind === "section" && row.key === "price");
    const row = form.layout[price];
    if (row.kind !== "section") throw new Error("expected a section row");
    form.layout[price] = { ...row, columns: { ...row.columns, description: "Item" } };
    const half = bodyFromLayoutForm(form);
    expect(half.ok).toBe(false);
    if (!half.ok) expect(half.errors[`layout.${price}.options.columns.visits`]).toBeDefined();
    form.layout[price] = row;
    const saved = bodyFromLayoutForm(form);
    expect(saved.ok && saved.body.schema === 2 && saved.body.layout[price]).toEqual({ kind: "section", key: "price" });
  });

  test("C5547: a new template starts from the Standard layout and today's options, and the preview draws it before it is named", () => {
    expect(EMPTY_LAYOUT_FORM.layout.map((row) => (row.kind === "section" ? row.key : row.type))).toEqual(["price", "schedule", "included", "equipment", "terms"]);
    expect(EMPTY_LAYOUT_FORM.doc.title).toBe("Preventive maintenance service agreement");
    expect(bodyFromLayoutForm(EMPTY_LAYOUT_FORM).ok).toBe(false);
    expect(previewBodyFromLayoutForm(EMPTY_LAYOUT_FORM).ok).toBe(true);
  });

  test("C5547: a posted form is read field by field and anything off is one error naming where", () => {
    expect(readLayoutFormInput(JSON.parse(JSON.stringify(EMPTY_LAYOUT_FORM))).ok).toBe(true);
    expect(readLayoutFormInput({ ...EMPTY_LAYOUT_FORM, doc: { ...EMPTY_LAYOUT_FORM.doc, pageHeader: "sometimes" } })).toEqual({
      ok: false,
      errors: [{ field: "doc.pageHeader", message: "The page header must be first or every." }],
    });
    const bad = readLayoutFormInput({ ...EMPTY_LAYOUT_FORM, layout: [{ kind: "block", type: "heading", text: "x", level: 3, indent: 0, pageBreakBefore: false }] });
    expect(bad).toEqual({ ok: false, errors: [{ field: "layout.0.level", message: "The heading level must be 1 or 2." }] });
    expect(readLayoutFormInput({ ...EMPTY_LAYOUT_FORM, name: 3 }).ok).toBe(false);
  });
});
