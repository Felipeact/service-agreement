import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  agreementTemplateValues,
  blocksToText,
  derivedFrequency,
  previewSummary,
  renderAgreementTemplate,
  skippedCodes,
  SYSTEM_AGREEMENT_BODY,
  textToBlocks,
  validateAgreementTemplate,
  type AgreementTemplateBody,
} from "./template";

const GOOD: AgreementTemplateBody = {
  schema: 1,
  name: "Quarterly HVAC",
  description: "Four visits a year.",
  intro: [{ type: "paragraph", text: "Welcome." }],
  footer: [{ type: "clause", text: "Payment is due." }],
  sections: { schedule: true, scope: false },
  preset: { termMonths: 12, lines: [{ description: "Quarterly visit", visitMonths: [3, 6, 9, 12], assetTypeCodes: ["RTU"], costPerVisitCents: 45000 }] },
};

const withBody = (over: Record<string, unknown>) => ({ ...GOOD, ...over });
const line = (over: Record<string, unknown> = {}) => ({ description: "L", visitMonths: [3], assetTypeCodes: [], costPerVisitCents: null, ...over });
const rejected = (input: unknown) => {
  const result = validateAgreementTemplate(input);
  return result.ok ? null : result;
};

describe("validateAgreementTemplate", () => {
  test("C5324: a valid body is accepted as it is", () => {
    expect(validateAgreementTemplate(GOOD)).toEqual({ ok: true, body: GOOD });
  });

  test.each<[string, unknown, string, string]>([
    ["an empty name", withBody({ name: "" }), "name", "Name is required"],
    ["a name over 80 characters", withBody({ name: "x".repeat(81) }), "name", "at most 80"],
    ["a description over 300", withBody({ description: "x".repeat(301) }), "description", "at most 300"],
    ["31 blocks in the intro", withBody({ intro: Array.from({ length: 31 }, () => ({ type: "paragraph", text: "x" })) }), "intro", "at most 30"],
    ["31 blocks in the footer", withBody({ footer: Array.from({ length: 31 }, () => ({ type: "paragraph", text: "x" })) }), "footer", "at most 30"],
    ["a text over 2,000", withBody({ intro: [{ type: "paragraph", text: "x".repeat(2001) }] }), "intro", "too long"],
    ["an unknown variable", withBody({ footer: [{ type: "paragraph", text: "Hi {{customer.nickname}}" }] }), "footer", "customer.nickname"],
    ["21 preset lines", withBody({ preset: { termMonths: null, lines: Array.from({ length: 21 }, () => line()) } }), "preset.lines", "at most 20"],
    ["a visit month of 0", withBody({ preset: { termMonths: null, lines: [line({ visitMonths: [0, 3] })] } }), "preset.lines.0.visitMonths", "outside 1 to 12"],
    ["a visit month of 13", withBody({ preset: { termMonths: null, lines: [line({ visitMonths: [3, 13] })] } }), "preset.lines.0.visitMonths", "outside 1 to 12"],
    ["a repeated visit month", withBody({ preset: { termMonths: null, lines: [line({ visitMonths: [3, 3] })] } }), "preset.lines.0.visitMonths", "repeats"],
    ["a negative price", withBody({ preset: { termMonths: null, lines: [line({ costPerVisitCents: -1 })] } }), "preset.lines.0.costPerVisitCents", "not negative"],
    ["a fractional price", withBody({ preset: { termMonths: null, lines: [line({ costPerVisitCents: 10.5 })] } }), "preset.lines.0.costPerVisitCents", "whole number of cents"],
    ["a term of 0", withBody({ preset: { termMonths: 0, lines: [] } }), "preset.termMonths", "1 to 120"],
    ["a term of 121", withBody({ preset: { termMonths: 121, lines: [] } }), "preset.termMonths", "1 to 120"],
    ["an unknown top-level key", { ...GOOD, extra: 1 }, "body", "unknown key: extra"],
  ])("C5324: rejects %s", (_label, input, field, fragment) => {
    const result = rejected(input);
    expect(result).not.toBeNull();
    expect(result?.errors.map((error) => error.field)).toContain(field);
    expect(result?.reason).toContain(fragment);
  });

  test("C5324: names the unknown variable in the reason", () => {
    expect(rejected(withBody({ intro: [{ type: "clause", text: "{{terms.nope}}" }] }))?.reason).toContain("terms.nope");
  });

  test("C5324: accepts 30 blocks, 20 lines, an 80-character name and 120 months", () => {
    const body = withBody({
      name: "x".repeat(80),
      intro: Array.from({ length: 30 }, () => ({ type: "paragraph", text: "x" })),
      footer: Array.from({ length: 30 }, () => ({ type: "paragraph", text: "x" })),
      preset: { termMonths: 120, lines: Array.from({ length: 20 }, () => line()) },
    });
    expect(validateAgreementTemplate(body).ok).toBe(true);
  });

  test("C5324: a body that is not an object, or is schema 2, is rejected", () => {
    expect(rejected([])?.reason).toContain("not an object");
    expect(rejected(null)?.ok).toBe(false);
    expect(rejected({ ...GOOD, schema: 2 })?.reason).toContain("schema 2");
  });

  test("C5324: reports every field that fails, each with its own message", () => {
    const result = rejected(withBody({ name: "", description: "x".repeat(301) }));
    expect(result?.errors.map((error) => error.field)).toEqual(["name", "description"]);
  });
});

describe("the editor text format", () => {
  test("C5325: a # line is a heading, a - line a clause, any other line a paragraph, blank lines are dropped", () => {
    expect(textToBlocks("# Scope\n\n- Payment is due.\r\nHello.\n   \n")).toEqual([
      { type: "heading", text: "Scope" },
      { type: "clause", text: "Payment is due." },
      { type: "paragraph", text: "Hello." },
    ]);
  });

  test("C5325: blocksToText(textToBlocks(t)) equals t for those three line kinds", () => {
    const text = "# Scope\n- Payment is due.\nHello.\n- Second clause.";
    expect(blocksToText(textToBlocks(text))).toBe(text);
  });
});

describe("derivedFrequency", () => {
  const preset = (...counts: number[][]) => ({
    termMonths: null,
    lines: counts.map((visitMonths) => ({ description: "L", visitMonths, assetTypeCodes: [], costPerVisitCents: null })),
  });
  const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  test.each<[string, ReturnType<typeof preset>, string | null]>([
    ["12 visit months", preset(ALL), "Monthly"],
    ["4 visit months", preset([3, 6, 9, 12]), "Quarterly"],
    ["2 visit months", preset([4, 10]), "Semiannual"],
    ["1 visit month", preset([6]), "Annual"],
    ["lines that differ", preset([3, 6, 9, 12], [4, 10]), "Mixed"],
    ["no lines", preset(), null],
  ])("C5326: %s gives %s", (_label, input, expected) => {
    expect(derivedFrequency(input)).toBe(expected);
  });

  test("C5326: two lines with the same cadence share its label", () => {
    expect(derivedFrequency(preset([3, 6, 9, 12], [1, 4, 7, 10]))).toBe("Quarterly");
  });
});

describe("previewSummary", () => {
  const body: AgreementTemplateBody = {
    ...GOOD,
    intro: [
      { type: "heading", text: "Welcome" },
      { type: "clause", text: "One." },
    ],
    footer: [
      { type: "clause", text: "Two." },
      { type: "clause", text: "Three." },
      { type: "paragraph", text: "Thanks." },
    ],
    sections: { schedule: true, scope: true },
    preset: {
      termMonths: 12,
      lines: [
        { description: "A", visitMonths: [3], assetTypeCodes: ["RTU", "NOPE"], costPerVisitCents: null },
        { description: "B", visitMonths: [4], assetTypeCodes: ["RTU", "BOILER"], costPerVisitCents: 100 },
        { description: "C", visitMonths: [5], assetTypeCodes: [], costPerVisitCents: 100 },
      ],
    },
  };

  test("C5327: reads the sections and clauses from the body", () => {
    const summary = previewSummary(body, {});
    expect(summary.sections).toBe("2 sections");
    expect(summary.clauses).toBe("3 clauses");
  });

  test("C5327: names equipment in the org's type names and a code with no type as the code", () => {
    expect(previewSummary(body, { RTU: "Rooftop unit", BOILER: "Boiler" }).equipmentTypes).toEqual(["Rooftop unit", "NOPE", "Boiler"]);
  });

  test("C5327: reads '3 lines · 12 months term' or 'No preset lines'", () => {
    expect(previewSummary(body, {}).preset).toBe("3 lines · 12 months term");
    expect(previewSummary(GOOD, {}).preset).toBe("1 line · 12 months term");
    expect(previewSummary({ ...body, preset: { termMonths: 24, lines: [] } }, {}).preset).toBe("No preset lines");
  });

  test("C5327: a preset with lines and no term reads the lines only; one section reads in the singular", () => {
    expect(previewSummary({ ...body, preset: { ...body.preset, termMonths: null }, sections: { schedule: false, scope: true } }, {})).toMatchObject({
      preset: "3 lines",
      sections: "1 section",
    });
  });
});

describe("skippedCodes", () => {
  test("C5358: returns the preset codes with no type in the org, once each, in preset order", () => {
    const body: AgreementTemplateBody = {
      ...GOOD,
      preset: {
        termMonths: null,
        lines: [
          { description: "A", visitMonths: [3], assetTypeCodes: ["RTU", "NOPE"], costPerVisitCents: null },
          { description: "B", visitMonths: [4], assetTypeCodes: ["NOPE", "AHU", "GONE"], costPerVisitCents: null },
        ],
      },
    };
    expect(skippedCodes(body, ["RTU", "BOILER"])).toEqual(["NOPE", "AHU", "GONE"]);
  });

  test("C5358: a preset whose codes all exist skips none", () => {
    expect(skippedCodes(GOOD, ["RTU"])).toEqual([]);
    expect(skippedCodes(SYSTEM_AGREEMENT_BODY, [])).toEqual([]);
  });
});

describe("rendering an agreement's texts", () => {
  const values = agreementTemplateValues(
    { repairDiscountPct: 10, cpiCapPct: 5, cancellationNoticeDays: null, paymentDays: 30, governingProvince: null, taxNote: null, renewalNoticeDays: null, cpiRenegotiationThresholdPct: null },
    12,
    { tenant: "Kettle Ridge", customer: "Fernwood Dental", site: "Main" },
  );

  test("C5323: a clause using a variable with no value is omitted and a paragraph prints with an empty replacement", () => {
    const body: AgreementTemplateBody = {
      ...GOOD,
      intro: [
        { type: "clause", text: "Cancel with {{terms.cancellationNoticeDays}} notice." },
        { type: "clause", text: "Invoices are payable within {{terms.paymentDays}}." },
        { type: "paragraph", text: "Governed by {{province}} law." },
      ],
    };
    expect(renderAgreementTemplate(body, values).intro).toEqual([
      { type: "clause", text: "Invoices are payable within 30 days." },
      { type: "paragraph", text: "Governed by  law." },
    ]);
  });

  test("C5323: the names come from the tenant, the customer and the site", () => {
    const body: AgreementTemplateBody = { ...GOOD, footer: [{ type: "paragraph", text: "{{tenant.legalName}} / {{customer.name}} / {{site.name}} / {{term.label}}" }] };
    expect(renderAgreementTemplate(body, values).footer).toEqual([{ type: "paragraph", text: "Kettle Ridge / Fernwood Dental / Main / 12 months" }]);
  });
});

describe("the system body", () => {
  test("C5333: SYSTEM_AGREEMENT_BODY equals the system version 1 JSON stored by the migration", () => {
    const sql = readFileSync(path.join(__dirname, "..", "..", "..", "supabase", "migrations", "20261112240000_agreement_templates.sql"), "utf8");
    const stored = /'00000000-0000-4000-8000-00000000c102'[^$]*\$body\$([\s\S]*?)\$body\$::jsonb/.exec(sql);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored![1])).toEqual(SYSTEM_AGREEMENT_BODY);
  });

  test("C5333: the system body is a valid template with no text, every section shown and no preset", () => {
    expect(validateAgreementTemplate(SYSTEM_AGREEMENT_BODY).ok).toBe(true);
    expect(SYSTEM_AGREEMENT_BODY).toMatchObject({ name: "Standard agreement", intro: [], footer: [], sections: { schedule: true, scope: true }, preset: { termMonths: null, lines: [] } });
  });
});
