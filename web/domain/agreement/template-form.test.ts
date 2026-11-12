import { describe, expect, test } from "vitest";
import { copyName } from "./template";
import { bodyFromTemplateForm, EMPTY_TEMPLATE_FORM, templateFormFromBody } from "./template-form";

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
