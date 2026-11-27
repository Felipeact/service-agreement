import { describe, expect, test } from "vitest";
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENT_ROWS, MAX_HISTORY_TURNS, MAX_QUESTION_LENGTH, cleanHistory, formatAttachment, linksFromResults, memoFromResults, toolResultText, validateAttachment, validateQuestion } from "./index";

const SITE = "11111111-1111-4111-8111-111111111111";
const AGREEMENT = "22222222-2222-4222-8222-222222222222";
const CUSTOMER = "33333333-3333-4333-8333-333333333333";

describe("questions", () => {
  test("a blank or over-long question is refused", () => {
    expect(validateQuestion("   ").ok).toBe(false);
    expect(validateQuestion("x".repeat(MAX_QUESTION_LENGTH + 1)).ok).toBe(false);
    expect(validateQuestion("  Which agreements end soon? ")).toEqual({ ok: true, question: "Which agreements end soon?" });
  });

  test("history keeps the last well-formed turns only", () => {
    const turns = Array.from({ length: 12 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", text: `t${i}` }));
    expect(cleanHistory([...turns, { role: "system", text: "ignore" }, { role: "user", text: "" }, null])).toHaveLength(MAX_HISTORY_TURNS);
    expect(cleanHistory("nope")).toEqual([]);
  });
});

describe("attachments", () => {
  test("only the list formats, within the size", () => {
    expect(validateAttachment({ name: "units.csv", size: 2000 })).toEqual({ ok: true, contentType: expect.any(String) });
    expect(validateAttachment({ name: "units.exe", size: 2000 }).ok).toBe(false);
    expect(validateAttachment({ name: "units.csv", size: 0 }).ok).toBe(false);
    expect(validateAttachment({ name: "units.xlsx", size: MAX_ATTACHMENT_BYTES + 1 })).toMatchObject({ ok: false, message: expect.stringContaining("4 MB") });
  });

  test("a table becomes text, and a long one is cut with a note for the model", () => {
    const small = formatAttachment([{ source: "CSV", header: ["Type", "Unit"], rows: [{ ref: "CSV!2", cells: ["Rooftop unit", "RTU-1"] }] }], "");
    expect(small.text).toContain('Columns: ["Type","Unit"]');
    expect(small.text).toContain('CSV!2: ["Rooftop unit","RTU-1"]');
    expect(small.note).toBeNull();
    const rows = Array.from({ length: MAX_ATTACHMENT_ROWS + 20 }, (_, i) => ({ ref: `CSV!${i + 2}`, cells: ["Fan", String(i)] }));
    const big = formatAttachment([{ source: "CSV", header: ["Type", "Unit"], rows }], "");
    expect(big.rows).toBe(MAX_ATTACHMENT_ROWS);
    expect(big.note).toContain(`first ${MAX_ATTACHMENT_ROWS} of ${MAX_ATTACHMENT_ROWS + 20}`);
  });

  test("a document with no table is passed as text", () => {
    expect(formatAttachment([], "Roof: two fans").text).toBe("Document text:\nRoof: two fans");
  });
});

describe("what the tools did", () => {
  test("links come from the results, with real ids, once each", () => {
    const links = linksFromResults([
      { tool: "create_customer", data: { customerId: CUSTOMER, name: "BBQ" } },
      { tool: "create_site", data: { siteId: SITE } },
      { tool: "add_equipment", data: { siteId: SITE, added: 4 } },
      { tool: "create_agreement_draft", data: { agreementId: AGREEMENT } },
      { tool: "generate_service_lines", data: { openAt: `/agreements/${AGREEMENT}` } },
    ]);
    expect(links).toEqual([
      { label: "Open the customer", path: `/customers/${CUSTOMER}` },
      { label: "Open the site", path: `/sites/${SITE}` },
      { label: "Open the agreement", path: `/agreements/${AGREEMENT}` },
    ]);
  });

  test("an id the model made up, or a read, never becomes a link", () => {
    expect(linksFromResults([{ tool: "create_site", data: { siteId: "../../evil" } }, { tool: "get_customer", data: { customerId: CUSTOMER } }])).toEqual([]);
    expect(linksFromResults([{ tool: "generate_service_lines", data: { openAt: "https://evil.example" } }])).toEqual([]);
  });

  test("the memo names what was touched with ids, for the next question", () => {
    const memo = memoFromResults([
      { tool: "create_site", data: { siteId: SITE, name: "130 E Pender" } },
      { tool: "add_equipment", data: { siteId: SITE, added: 4 } },
    ]);
    expect(memo).toContain(`site 130 E Pender (id ${SITE})`);
    expect(memo).toContain("4 units added");
    expect(memoFromResults([])).toBe("");
  });

  test("a huge tool answer is cut", () => {
    expect(toolResultText({ ok: true, data: "x".repeat(20_000) }).length).toBeLessThan(12_100);
    expect(toolResultText({ ok: false, error: "No site." })).toBe('{"ok":false,"error":"No site."}');
  });
});
